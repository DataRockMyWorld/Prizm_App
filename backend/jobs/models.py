from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class JobRequest(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        SEARCHING = "searching", "Searching"
        MATCHED = "matched", "Matched"
        ACCEPTED = "accepted", "Accepted"
        ON_MY_WAY = "on_my_way", "On my way"
        ARRIVED = "arrived", "Arrived"
        IN_PROGRESS = "in_progress", "In progress"
        AWAITING_PRICE_CONFIRMATION = (
            "awaiting_price_confirmation",
            "Awaiting price confirmation",
        )
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        DISPUTED = "disputed", "Disputed"

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="jobs_requested",
    )
    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="jobs_assigned",
        null=True,
        blank=True,
    )
    category = models.ForeignKey(
        "services.ServiceCategory", on_delete=models.PROTECT, related_name="jobs"
    )
    description = models.TextField(blank=True)
    location = gis_models.PointField(geography=True)
    address = models.CharField(max_length=255, blank=True)
    photo = models.ImageField(upload_to="job_photos/", blank=True, null=True)
    status = models.CharField(
        max_length=30, choices=Status.choices, default=Status.REQUESTED
    )
    price_range_min = models.DecimalField(max_digits=8, decimal_places=2)
    price_range_max = models.DecimalField(max_digits=8, decimal_places=2)
    agreed_price = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    worker_note = models.TextField(blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"JobRequest #{self.pk} ({self.status})"


class JobOffer(models.Model):
    """A targeted, time-boxed offer of a job to one candidate worker.

    Matching is sequential, one candidate at a time, ranked by priority
    (Certified/Verified) then distance: see jobs.matching. Only one offer
    is outstanding per job at a time.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        EXPIRED = "expired", "Expired"

    job = models.ForeignKey(JobRequest, on_delete=models.CASCADE, related_name="offers")
    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="job_offers"
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    offered_at = models.DateTimeField(auto_now_add=True)
    responds_by = models.DateTimeField()
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("job", "worker")
        ordering = ["-offered_at"]

    def __str__(self):
        return f"Offer(job={self.job_id}, worker={self.worker_id}, {self.status})"


class Message(models.Model):
    job = models.ForeignKey(JobRequest, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="messages"
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Message #{self.pk} on job #{self.job_id}"


class Report(models.Model):
    class Category(models.TextChoices):
        NO_SHOW = "no_show", "No-show"
        SAFETY_CONCERN = "safety_concern", "Safety concern"
        QUALITY_OF_WORK = "quality_of_work", "Quality of work"
        PRICING_DISAGREEMENT = "pricing_disagreement", "Pricing disagreement"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        REVIEWING = "reviewing", "Reviewing"
        RESOLVED = "resolved", "Resolved"

    job = models.ForeignKey(JobRequest, on_delete=models.CASCADE, related_name="reports")
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reports_filed",
    )
    category = models.CharField(max_length=30, choices=Category.choices)
    details = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Report #{self.pk} on job #{self.job_id} ({self.category})"


class Rating(models.Model):
    job = models.OneToOneField(JobRequest, on_delete=models.CASCADE, related_name="rating")
    stars = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Rating({self.stars}★) for job #{self.job_id}"


class CancellationLog(models.Model):
    class Reason(models.TextChoices):
        PERSONAL_EMERGENCY = "personal_emergency", "Personal emergency"
        TRANSPORT_ISSUE = "transport_issue", "Vehicle or transport issue"
        JOB_DETAILS_UNCLEAR = "job_details_unclear", "Job details unclear"
        OTHER = "other", "Other"

    job = models.ForeignKey(
        JobRequest, on_delete=models.CASCADE, related_name="cancellation_logs"
    )
    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cancellations"
    )
    reason = models.CharField(max_length=30, choices=Reason.choices)
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Cancellation of job #{self.job_id} by {self.worker_id}"
