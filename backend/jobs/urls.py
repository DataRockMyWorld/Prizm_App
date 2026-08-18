from django.urls import path

from .views import (
    AcceptOfferView,
    ArrivedView,
    CompleteJobView,
    ConfirmPriceView,
    DeclineOfferView,
    DisputePriceView,
    JobCancelView,
    JobRequestDetailView,
    JobRequestListCreateView,
    NearbyJobsView,
    OnMyWayView,
    RateJobView,
    ReportJobView,
    StartJobView,
    WorkerIncomingOfferView,
    WorkerStatusView,
)

urlpatterns = [
    path("", JobRequestListCreateView.as_view(), name="job-list-create"),
    path("nearby/", NearbyJobsView.as_view(), name="jobs-nearby"),
    path("worker/status/", WorkerStatusView.as_view(), name="worker-status"),
    path("worker/incoming/", WorkerIncomingOfferView.as_view(), name="worker-incoming"),
    path("offers/<int:pk>/accept/", AcceptOfferView.as_view(), name="offer-accept"),
    path("offers/<int:pk>/decline/", DeclineOfferView.as_view(), name="offer-decline"),
    path("<int:pk>/", JobRequestDetailView.as_view(), name="job-detail"),
    path("<int:pk>/cancel/", JobCancelView.as_view(), name="job-cancel"),
    path("<int:pk>/on-my-way/", OnMyWayView.as_view(), name="job-on-my-way"),
    path("<int:pk>/arrived/", ArrivedView.as_view(), name="job-arrived"),
    path("<int:pk>/start/", StartJobView.as_view(), name="job-start"),
    path("<int:pk>/complete/", CompleteJobView.as_view(), name="job-complete"),
    path("<int:pk>/confirm-price/", ConfirmPriceView.as_view(), name="job-confirm-price"),
    path("<int:pk>/dispute-price/", DisputePriceView.as_view(), name="job-dispute-price"),
    path("<int:pk>/rate/", RateJobView.as_view(), name="job-rate"),
    path("<int:pk>/report/", ReportJobView.as_view(), name="job-report"),
]
