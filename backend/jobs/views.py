from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Block, User, WorkerProfile
from notifications.tasks import send_push_notification

from .matching import MATCHING_RADIUS_KM, refresh_job_matching, rematch_nearby_jobs_for_worker, try_match
from .models import CancellationLog, JobOffer, JobRequest, Message, Rating, Report
from .permissions import IsCustomerRole, IsWorkerRole
from .serializers import (
    JobOfferSerializer,
    JobRequestCreateSerializer,
    JobRequestSerializer,
    MessageSerializer,
    NearbyJobSerializer,
    QuoteSerializer,
    RatingCreateSerializer,
    ReportCreateSerializer,
    WorkerCancelSerializer,
    WorkerStatusSerializer,
    WorkerStatusUpdateSerializer,
)


def _first_name(user):
    """First name for notification copy, with a neutral fallback."""
    return (user.full_name or "").split(" ")[0] or "The customer"


class JobsPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 50


class JobRequestListCreateView(APIView):
    """GET: the caller's own jobs (customer's requests, or worker's assigned jobs).

    Two opt-in query params, both off by default (bare `GET /api/jobs/`
    returns every job unpaginated, exactly as before — several other call
    sites, e.g. the account-deletion blocking-job check and the customer
    Messages tab, need the full history and must keep working unchanged):

    - `status_group=active|completed` filters server-side using the same
      TERMINAL_STATUSES split the Jobs tab already draws client-side —
      "completed" here also covers cancelled/disputed, matching that tab's
      own definition.
    - `page=<n>` switches the response to DRF's standard paginated shape
      (`count`/`next`/`previous`/`results`). Meant for `status_group=
      completed`: a customer/worker's completed history has no natural
      upper bound and grows for as long as they use the app, unlike
      "active" (in practice always a small working set) which the Jobs
      tab still fetches in one unpaginated call.

    POST: a customer submits a new service request. Estimate range is
    snapshotted from the category, and matching is attempted immediately.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == User.Role.WORKER:
            qs = JobRequest.objects.filter(worker=request.user)
        else:
            qs = JobRequest.objects.filter(customer=request.user)
        qs = qs.select_related("category", "worker").order_by("-created_at")

        status_group = request.query_params.get("status_group")
        if status_group == "completed":
            qs = qs.filter(status__in=JobRequest.TERMINAL_STATUSES)
        elif status_group == "active":
            qs = qs.exclude(status__in=JobRequest.TERMINAL_STATUSES)

        if request.query_params.get("page") is not None:
            paginator = JobsPagination()
            page = paginator.paginate_queryset(qs, request, view=self)
            return paginator.get_paginated_response(JobRequestSerializer(page, many=True).data)

        return Response(JobRequestSerializer(qs, many=True).data)

    def post(self, request):
        if request.user.role != User.Role.CUSTOMER:
            return Response({"detail": "Only customers can request a service."}, status=403)

        serializer = JobRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        category = data["category"]

        job = JobRequest.objects.create(
            customer=request.user,
            category=category,
            description=data.get("description", ""),
            location=Point(data["longitude"], data["latitude"], srid=4326),
            address=data.get("address", ""),
            photo=data.get("photo"),
            status=JobRequest.Status.SEARCHING,
            price_range_min=category.estimate_min,
            price_range_max=category.estimate_max,
        )
        try_match(job)
        job.refresh_from_db()
        return Response(JobRequestSerializer(job).data, status=201)


class JobRequestDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if request.user.id not in (job.customer_id, job.worker_id):
            return Response({"detail": "Not found."}, status=404)
        refresh_job_matching(job)
        job.refresh_from_db()
        return Response(JobRequestSerializer(job).data)


class JobCancelView(APIView):
    """Customer: free cancel while still searching/matched (before a worker commits).

    Worker: free cancel within 10 minutes of accepting, with a required
    reason. After that window, cancellation goes through Report a problem
    instead (see CLAUDE.md's Worker cancellation rule).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        user = request.user

        if job.customer_id == user.id:
            if job.status not in (
                JobRequest.Status.REQUESTED,
                JobRequest.Status.SEARCHING,
                JobRequest.Status.MATCHED,
            ):
                return Response(
                    {"detail": "This job can no longer be cancelled directly — use Report a problem instead."},
                    status=400,
                )
            job.status = JobRequest.Status.CANCELLED
            job.save(update_fields=["status", "updated_at"])
            return Response(JobRequestSerializer(job).data)

        if job.worker_id == user.id:
            if job.status != JobRequest.Status.ACCEPTED:
                return Response(
                    {"detail": "Cancellation is only available right after accepting, before you're on your way."},
                    status=400,
                )
            if job.accepted_at is None or timezone.now() - job.accepted_at > timezone.timedelta(minutes=10):
                return Response(
                    {"detail": "The 10-minute free-cancellation window has passed — use Report a problem instead."},
                    status=400,
                )
            serializer = WorkerCancelSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            CancellationLog.objects.create(
                job=job,
                worker=user,
                reason=serializer.validated_data["reason"],
                note=serializer.validated_data["note"],
            )
            job.worker = None
            job.status = JobRequest.Status.SEARCHING
            job.accepted_at = None
            job.save(update_fields=["worker", "status", "accepted_at", "updated_at"])
            try_match(job)
            return Response(JobRequestSerializer(job).data)

        return Response({"detail": "Not your job."}, status=403)


class _WorkerJobTransitionView(APIView):
    """Simple worker-side status transitions with no extra input (arrived/start).

    The v2 flow (docs/prds/active-job-flow-v2.md) is:
    accepted → arrived → quote_pending → quote_accepted → in_progress → completed.
    """

    permission_classes = [IsAuthenticated, IsWorkerRole]
    required_current = None
    target_status = None
    # Model field to stamp with the current time on this transition — the
    # customer's live job-status timeline (see JobRequestSerializer) shows
    # this alongside the step it reached, e.g. "Arrived · 9:24 AM".
    timestamp_field = None
    error_detail = "This job isn't in the right state for that."

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if job.worker_id != request.user.id:
            return Response({"detail": "Not your job."}, status=403)
        if job.status != self.required_current:
            return Response({"detail": self.error_detail}, status=400)
        job.status = self.target_status
        update_fields = ["status", "updated_at"]
        if self.timestamp_field:
            setattr(job, self.timestamp_field, timezone.now())
            update_fields.append(self.timestamp_field)
        job.save(update_fields=update_fields)
        return Response(JobRequestSerializer(job).data)


class ArrivedView(_WorkerJobTransitionView):
    required_current = JobRequest.Status.ACCEPTED
    target_status = JobRequest.Status.ARRIVED
    timestamp_field = "arrived_at"
    error_detail = "You need to have accepted the job before marking arrived."


class StartJobView(_WorkerJobTransitionView):
    required_current = JobRequest.Status.QUOTE_ACCEPTED
    target_status = JobRequest.Status.IN_PROGRESS
    timestamp_field = "started_at"
    error_detail = "The customer needs to confirm your quote before you start."


class QuoteView(APIView):
    """Worker submits (or re-submits) an on-site quote for the customer to confirm.

    Valid from `arrived` (first quote) or `quote_pending` (overwrite a quote
    the customer hasn't acted on yet). Sets the price before any work — see
    docs/prds/active-job-flow-v2.md.
    """

    permission_classes = [IsAuthenticated, IsWorkerRole]

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if job.worker_id != request.user.id:
            return Response({"detail": "Not your job."}, status=403)
        if job.status not in (
            JobRequest.Status.ARRIVED,
            JobRequest.Status.QUOTE_PENDING,
        ):
            return Response(
                {"detail": "You can only send a quote once you've arrived."},
                status=400,
            )

        serializer = QuoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        first_quote = job.status == JobRequest.Status.ARRIVED
        job.agreed_price = serializer.validated_data["agreed_price"]
        job.worker_note = serializer.validated_data.get("note", "")
        job.status = JobRequest.Status.QUOTE_PENDING
        update_fields = ["agreed_price", "worker_note", "status", "updated_at"]
        if first_quote:
            job.quoted_at = timezone.now()
            update_fields.append("quoted_at")
        job.save(update_fields=update_fields)

        if first_quote:
            send_push_notification.delay(
                job.customer_id,
                title="New price to review",
                body=f"Your {job.category.name} worker sent a price — tap to review",
                data={"type": "quote_pending", "job_id": job.id},
            )
        return Response(JobRequestSerializer(job).data)


class DeclineJobView(APIView):
    """Worker declines the job after arriving and evaluating it (terminal)."""

    permission_classes = [IsAuthenticated, IsWorkerRole]

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if job.worker_id != request.user.id:
            return Response({"detail": "Not your job."}, status=403)
        if job.status not in (
            JobRequest.Status.ARRIVED,
            JobRequest.Status.QUOTE_PENDING,
        ):
            return Response(
                {"detail": "You can only decline after arriving, before work starts."},
                status=400,
            )

        serializer = WorkerCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        CancellationLog.objects.create(
            job=job,
            worker=request.user,
            kind=CancellationLog.Kind.ON_SITE_DECLINE,
            reason=serializer.validated_data["reason"],
            note=serializer.validated_data["note"],
        )
        job.status = JobRequest.Status.DECLINED
        job.save(update_fields=["status", "updated_at"])
        send_push_notification.delay(
            job.customer_id,
            title="Job could not be taken",
            body=f"Your {job.category.name} worker couldn't take the job — you can request again",
            data={"type": "job_declined", "job_id": job.id},
        )
        return Response(JobRequestSerializer(job).data)


class CompleteJobView(APIView):
    """Worker marks the job complete. No price step — it was agreed at the quote."""

    permission_classes = [IsAuthenticated, IsWorkerRole]

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if job.worker_id != request.user.id:
            return Response({"detail": "Not your job."}, status=403)
        if job.status != JobRequest.Status.IN_PROGRESS:
            return Response({"detail": "Job must be in progress to mark complete."}, status=400)

        job.status = JobRequest.Status.COMPLETED
        job.save(update_fields=["status", "updated_at"])
        return Response(JobRequestSerializer(job).data)


class ConfirmQuoteView(APIView):
    """Customer confirms the worker's on-site quote — unlocks 'Start work'."""

    permission_classes = [IsAuthenticated, IsCustomerRole]

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if job.customer_id != request.user.id:
            return Response({"detail": "Not your job."}, status=403)
        if job.status != JobRequest.Status.QUOTE_PENDING:
            return Response({"detail": "No quote is awaiting confirmation."}, status=400)
        job.status = JobRequest.Status.QUOTE_ACCEPTED
        job.quote_accepted_at = timezone.now()
        job.save(update_fields=["status", "quote_accepted_at", "updated_at"])
        send_push_notification.delay(
            job.worker_id,
            title="Quote accepted",
            body=f"{_first_name(job.customer)} accepted your quote — you can start",
            data={"type": "quote_accepted", "job_id": job.id},
        )
        return Response(JobRequestSerializer(job).data)


class RejectQuoteView(APIView):
    """Customer rejects the worker's quote — closes the job (they can re-request)."""

    permission_classes = [IsAuthenticated, IsCustomerRole]

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if job.customer_id != request.user.id:
            return Response({"detail": "Not your job."}, status=403)
        if job.status != JobRequest.Status.QUOTE_PENDING:
            return Response({"detail": "No quote is awaiting confirmation."}, status=400)
        job.status = JobRequest.Status.CANCELLED
        job.save(update_fields=["status", "updated_at"])
        send_push_notification.delay(
            job.worker_id,
            title="Quote not accepted",
            body=f"{_first_name(job.customer)} didn't accept the quote",
            data={"type": "quote_rejected", "job_id": job.id},
        )
        return Response(JobRequestSerializer(job).data)


class DisputePriceView(APIView):
    """Customer disputes the agreed price after the job is done → manual admin review."""

    permission_classes = [IsAuthenticated, IsCustomerRole]

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if job.customer_id != request.user.id:
            return Response({"detail": "Not your job."}, status=403)
        if job.status != JobRequest.Status.COMPLETED:
            return Response(
                {"detail": "You can only dispute the price of a completed job."},
                status=400,
            )

        details = request.data.get("details", "")
        Report.objects.create(
            job=job,
            reporter=request.user,
            category=Report.Category.PRICING_DISAGREEMENT,
            details=details,
        )
        job.status = JobRequest.Status.DISPUTED
        job.save(update_fields=["status", "updated_at"])
        return Response(JobRequestSerializer(job).data)


class RateJobView(APIView):
    permission_classes = [IsAuthenticated, IsCustomerRole]

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if job.customer_id != request.user.id:
            return Response({"detail": "Not your job."}, status=403)
        if job.status != JobRequest.Status.COMPLETED:
            return Response({"detail": "You can only rate a completed job."}, status=400)
        if hasattr(job, "rating"):
            return Response({"detail": "This job has already been rated."}, status=400)

        serializer = RatingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        Rating.objects.create(job=job, **serializer.validated_data)
        return Response(status=201)


class ReportJobView(APIView):
    """'Report a problem': No-show / Safety concern / Quality of work / Pricing disagreement."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if request.user.id not in (job.customer_id, job.worker_id):
            return Response({"detail": "Not your job."}, status=403)

        serializer = ReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        message_id = data.pop("message_id", None)
        message = None
        if message_id is not None:
            # Scoped to this job — a message_id belonging to a different
            # job is treated as not-found here, matching this file's
            # existing get_object_or_404 idiom for job-scoped lookups.
            message = get_object_or_404(Message, pk=message_id, job=job)
        report = Report.objects.create(
            job=job, reporter=request.user, message=message, **data
        )
        return Response({"id": report.id, "status": report.status}, status=201)


class BlockCounterpartView(APIView):
    """Blocks the other party of `job`, account-wide, once the job is
    terminal (see docs/prds/chat-safety.md §7). Target is always derived
    from the job, never client-supplied — no way to block a user id you
    don't share a terminal job with."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if request.user.id not in (job.customer_id, job.worker_id):
            return Response({"detail": "Not your job."}, status=403)
        if job.status not in JobRequest.TERMINAL_STATUSES:
            return Response({"detail": "This job is still active."}, status=400)

        other_party = job.worker if request.user.id == job.customer_id else job.customer
        if other_party is None:
            # A customer-cancelled job from before any worker was ever
            # assigned (e.g. cancelled while still SEARCHING) — nothing to
            # block. Not reachable via the chat UI, which requires
            # job.worker to exist, but guarded here since this endpoint is
            # a plain job-scoped POST.
            return Response({"detail": "This job has no other party to block."}, status=400)
        Block.objects.get_or_create(
            blocker=request.user, blocked=other_party, defaults={"job": job}
        )
        return Response(status=201)


class MessageListCreateView(APIView):
    """Per-job chat thread — coordination between customer and worker,
    separate from the ReportJobView dispute flow above."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if request.user.id not in (job.customer_id, job.worker_id):
            return Response({"detail": "Not your job."}, status=403)
        messages = job.messages.select_related("sender")
        return Response(MessageSerializer(messages, many=True).data)

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if request.user.id not in (job.customer_id, job.worker_id):
            return Response({"detail": "Not your job."}, status=403)
        if job.worker_id is None:
            return Response({"detail": "No worker assigned yet."}, status=400)
        if job.status in JobRequest.TERMINAL_STATUSES:
            return Response({"detail": "This job is closed."}, status=400)

        serializer = MessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = Message.objects.create(
            job=job, sender=request.user, text=serializer.validated_data["text"]
        )
        recipient_id = job.worker_id if request.user.id == job.customer_id else job.customer_id
        send_push_notification.delay(
            recipient_id,
            title=f"New message from {request.user.full_name}",
            body=message.text[:120],
            data={"type": "chat_message", "job_id": job.id},
        )
        return Response(MessageSerializer(message).data, status=201)


class AcceptOfferView(APIView):
    permission_classes = [IsAuthenticated, IsWorkerRole]

    def post(self, request, pk):
        offer = get_object_or_404(JobOffer, pk=pk)
        if offer.worker_id != request.user.id:
            return Response({"detail": "Not your offer."}, status=403)
        if offer.status != JobOffer.Status.PENDING:
            return Response({"detail": "This offer is no longer available."}, status=400)

        if offer.responds_by < timezone.now():
            job = offer.job
            refresh_job_matching(job)
            return Response({"detail": "This offer has expired."}, status=400)

        offer.status = JobOffer.Status.ACCEPTED
        offer.responded_at = timezone.now()
        offer.save(update_fields=["status", "responded_at"])

        job = offer.job
        job.status = JobRequest.Status.ACCEPTED
        job.accepted_at = timezone.now()
        job.save(update_fields=["status", "accepted_at", "updated_at"])
        send_push_notification.delay(
            job.customer_id,
            title="Job accepted",
            body=f"A worker is on the way for your {job.category.name} request",
            data={"type": "job_accepted", "job_id": job.id},
        )
        return Response(JobRequestSerializer(job).data)


class DeclineOfferView(APIView):
    permission_classes = [IsAuthenticated, IsWorkerRole]

    def post(self, request, pk):
        offer = get_object_or_404(JobOffer, pk=pk)
        if offer.worker_id != request.user.id:
            return Response({"detail": "Not your offer."}, status=403)
        if offer.status != JobOffer.Status.PENDING:
            return Response({"detail": "This offer is no longer active."}, status=400)

        offer.status = JobOffer.Status.DECLINED
        offer.responded_at = timezone.now()
        offer.save(update_fields=["status", "responded_at"])

        job = offer.job
        if job.worker_id == offer.worker_id:
            job.worker = None
            job.status = JobRequest.Status.SEARCHING
            job.save(update_fields=["worker", "status", "updated_at"])
        try_match(job)
        return Response({"detail": "Offer declined."})


class WorkerIncomingOfferView(generics.ListAPIView):
    """The worker's 'incoming request' screen: their currently pending offer(s)."""

    permission_classes = [IsAuthenticated, IsWorkerRole]
    serializer_class = JobOfferSerializer

    def get_queryset(self):
        pending = JobOffer.objects.filter(worker=self.request.user, status=JobOffer.Status.PENDING)
        for offer in list(pending):
            refresh_job_matching(offer.job)
        return (
            JobOffer.objects.filter(worker=self.request.user, status=JobOffer.Status.PENDING)
            .select_related("job", "job__category")
        )


class NearbyJobsView(generics.ListAPIView):
    """Informational only ('nearby jobs with estimate ranges' on the worker home screen) —
    matching is sequential single-offer (see jobs.matching), so accepting
    happens via the offer endpoints, not by picking from this list.
    """

    permission_classes = [IsAuthenticated, IsWorkerRole]
    serializer_class = NearbyJobSerializer

    def get_queryset(self):
        profile = self.request.user.worker_profile
        if not profile.last_location:
            return JobRequest.objects.none()
        return (
            JobRequest.objects.filter(
                status=JobRequest.Status.SEARCHING,
                category__in=profile.categories.all(),
            )
            .annotate(distance=Distance("location", profile.last_location))
            .filter(distance__lte=D(km=MATCHING_RADIUS_KM))
            .order_by("distance")[:20]
        )


class WorkerStatusView(APIView):
    """Online toggle + location ping, gating on ID submission per CLAUDE.md."""

    permission_classes = [IsAuthenticated, IsWorkerRole]

    def get(self, request):
        return Response(WorkerStatusSerializer(request.user.worker_profile).data)

    def patch(self, request):
        profile = request.user.worker_profile
        serializer = WorkerStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        update_fields = []
        if "latitude" in data:
            profile.last_location = Point(data["longitude"], data["latitude"], srid=4326)
            profile.last_location_updated_at = timezone.now()
            update_fields += ["last_location", "last_location_updated_at"]

        if "is_online" in data:
            if data["is_online"] and profile.id_status == WorkerProfile.IDStatus.NOT_SUBMITTED:
                return Response({"detail": "Upload your ID before going online."}, status=400)
            if data["is_online"] and profile.id_status == WorkerProfile.IDStatus.REJECTED:
                return Response(
                    {"detail": "Your ID was rejected — please resubmit before going online."},
                    status=400,
                )
            profile.is_online = data["is_online"]
            update_fields.append("is_online")

        if update_fields:
            profile.save(update_fields=update_fields)

        if profile.is_online:
            rematch_nearby_jobs_for_worker(profile)

        return Response(WorkerStatusSerializer(profile).data)
