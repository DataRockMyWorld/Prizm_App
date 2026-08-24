from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User, WorkerProfile

from .matching import MATCHING_RADIUS_KM, refresh_job_matching, rematch_nearby_jobs_for_worker, try_match
from .models import CancellationLog, JobOffer, JobRequest, Message, Rating, Report
from .permissions import IsCustomerRole, IsWorkerRole
from .serializers import (
    CompleteJobSerializer,
    JobOfferSerializer,
    JobRequestCreateSerializer,
    JobRequestSerializer,
    MessageSerializer,
    NearbyJobSerializer,
    RatingCreateSerializer,
    ReportCreateSerializer,
    WorkerCancelSerializer,
    WorkerStatusSerializer,
    WorkerStatusUpdateSerializer,
)


class JobRequestListCreateView(APIView):
    """GET: the caller's own jobs (customer's requests, or worker's assigned jobs).

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
    """Simple worker-side status transitions with no extra input (on-my-way/arrived/start)."""

    permission_classes = [IsAuthenticated, IsWorkerRole]
    required_current = None
    target_status = None
    error_detail = "This job isn't in the right state for that."

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if job.worker_id != request.user.id:
            return Response({"detail": "Not your job."}, status=403)
        if job.status != self.required_current:
            return Response({"detail": self.error_detail}, status=400)
        job.status = self.target_status
        job.save(update_fields=["status", "updated_at"])
        return Response(JobRequestSerializer(job).data)


class OnMyWayView(_WorkerJobTransitionView):
    required_current = JobRequest.Status.ACCEPTED
    target_status = JobRequest.Status.ON_MY_WAY
    error_detail = "Job must be accepted before you're on your way."


class ArrivedView(_WorkerJobTransitionView):
    required_current = JobRequest.Status.ON_MY_WAY
    target_status = JobRequest.Status.ARRIVED
    error_detail = "You need to be on your way before marking arrived."


class StartJobView(_WorkerJobTransitionView):
    required_current = JobRequest.Status.ARRIVED
    target_status = JobRequest.Status.IN_PROGRESS
    error_detail = "You need to have arrived before starting the job."


class CompleteJobView(APIView):
    """Worker marks the job complete and proposes a price."""

    permission_classes = [IsAuthenticated, IsWorkerRole]

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if job.worker_id != request.user.id:
            return Response({"detail": "Not your job."}, status=403)
        if job.status != JobRequest.Status.IN_PROGRESS:
            return Response({"detail": "Job must be in progress to mark complete."}, status=400)

        serializer = CompleteJobSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job.agreed_price = serializer.validated_data["agreed_price"]
        job.worker_note = serializer.validated_data.get("note", "")
        job.status = JobRequest.Status.AWAITING_PRICE_CONFIRMATION
        job.save(update_fields=["agreed_price", "worker_note", "status", "updated_at"])
        return Response(JobRequestSerializer(job).data)


class ConfirmPriceView(APIView):
    permission_classes = [IsAuthenticated, IsCustomerRole]

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if job.customer_id != request.user.id:
            return Response({"detail": "Not your job."}, status=403)
        if job.status != JobRequest.Status.AWAITING_PRICE_CONFIRMATION:
            return Response({"detail": "No price is awaiting confirmation."}, status=400)
        job.status = JobRequest.Status.COMPLETED
        job.save(update_fields=["status", "updated_at"])
        return Response(JobRequestSerializer(job).data)


class DisputePriceView(APIView):
    permission_classes = [IsAuthenticated, IsCustomerRole]

    def post(self, request, pk):
        job = get_object_or_404(JobRequest, pk=pk)
        if job.customer_id != request.user.id:
            return Response({"detail": "Not your job."}, status=403)
        if job.status != JobRequest.Status.AWAITING_PRICE_CONFIRMATION:
            return Response({"detail": "No price is awaiting confirmation."}, status=400)

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
        report = Report.objects.create(
            job=job, reporter=request.user, **serializer.validated_data
        )
        return Response({"id": report.id, "status": report.status}, status=201)


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
        if job.status in (
            JobRequest.Status.COMPLETED,
            JobRequest.Status.CANCELLED,
            JobRequest.Status.DISPUTED,
        ):
            return Response({"detail": "This job is closed."}, status=400)

        serializer = MessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = Message.objects.create(
            job=job, sender=request.user, text=serializer.validated_data["text"]
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
