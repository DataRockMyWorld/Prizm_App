"""Broadcast-and-first-to-accept matching, with Verified/Certified priority.

Rather than a browsable list, an eligible job is offered to exactly one
candidate worker at a time (the highest-priority one), who has
OFFER_RESPONSE_WINDOW_SECONDS to accept or decline. If they don't respond
in time (or decline), the job re-opens to the next-best candidate. There
is no background scheduler for this: expiry is checked lazily whenever a
job or a worker's offers are read (see refresh_job_matching), consistent
with this project's polling-first approach (see Chat in the build order).
"""

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.utils import timezone

from accounts.models import Certification, User
from notifications.tasks import send_push_notification

from .models import JobOffer, JobRequest

OFFER_RESPONSE_WINDOW_SECONDS = 60
MATCHING_RADIUS_KM = 25


def _best_candidate(job):
    already_offered = job.offers.values_list("worker_id", flat=True)
    candidates = list(
        User.objects.filter(
            role=User.Role.WORKER,
            worker_profile__is_online=True,
            worker_profile__categories=job.category,
            worker_profile__last_location__isnull=False,
        )
        .exclude(id__in=list(already_offered))
        .annotate(distance=Distance("worker_profile__last_location", job.location))
        .filter(distance__lte=D(km=MATCHING_RADIUS_KM))
        .select_related("worker_profile")
        .order_by("distance")[:50]
    )
    if not candidates:
        return None

    def rank(worker):
        profile = worker.worker_profile
        is_certified = profile.certifications.filter(
            category=job.category, status=Certification.Status.APPROVED
        ).exists()
        return (0 if is_certified else 1, 0 if profile.verified else 1, worker.distance.km)

    candidates.sort(key=rank)
    return candidates[0]


def try_match(job):
    """Offer `job` to the best eligible candidate, if it doesn't already have one."""
    if job.status != JobRequest.Status.SEARCHING:
        return
    if job.offers.filter(status=JobOffer.Status.PENDING).exists():
        return
    candidate = _best_candidate(job)
    if candidate is None:
        return
    JobOffer.objects.create(
        job=job,
        worker=candidate,
        responds_by=timezone.now() + timezone.timedelta(seconds=OFFER_RESPONSE_WINDOW_SECONDS),
    )
    job.worker = candidate
    job.status = JobRequest.Status.MATCHED
    job.save(update_fields=["worker", "status", "updated_at"])
    send_push_notification.delay(
        candidate.id,
        title="New job offer",
        body=f"{job.category.name} nearby — respond within 60 seconds",
        data={"type": "job_offer", "job_id": job.id},
    )


def refresh_job_matching(job):
    """Expire `job`'s offer if it's timed out, then try to (re)match it."""
    offer = job.offers.filter(status=JobOffer.Status.PENDING).first()
    if offer and offer.responds_by < timezone.now():
        offer.status = JobOffer.Status.EXPIRED
        offer.responded_at = timezone.now()
        offer.save(update_fields=["status", "responded_at"])
        if job.worker_id == offer.worker_id:
            job.worker = None
            job.status = JobRequest.Status.SEARCHING
            job.save(update_fields=["worker", "status", "updated_at"])
    try_match(job)


def rematch_nearby_jobs_for_worker(profile):
    """A worker just came online or moved — see if any waiting jobs can now be (re)matched."""
    if not profile.last_location:
        return
    jobs = (
        JobRequest.objects.filter(
            status__in=[JobRequest.Status.SEARCHING, JobRequest.Status.MATCHED],
            category__in=profile.categories.all(),
        )
        .annotate(distance=Distance("location", profile.last_location))
        .filter(distance__lte=D(km=MATCHING_RADIUS_KM))
        .order_by("created_at")[:20]
    )
    for job in jobs:
        refresh_job_matching(job)
