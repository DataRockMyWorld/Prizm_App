"""Guards for the v2 status model change (docs/prds/active-job-flow-v2.md T1)."""

import pytest

from jobs.models import JobRequest


def test_terminal_statuses_are_exactly_the_four_expected():
    assert set(JobRequest.TERMINAL_STATUSES) == {
        JobRequest.Status.COMPLETED,
        JobRequest.Status.CANCELLED,
        JobRequest.Status.DECLINED,
        JobRequest.Status.DISPUTED,
    }


def test_removed_statuses_are_gone():
    values = {s.value for s in JobRequest.Status}
    assert "on_my_way" not in values
    assert "awaiting_price_confirmation" not in values
    assert {"quote_pending", "quote_accepted", "declined"} <= values


@pytest.mark.django_db
def test_data_migration_remaps_old_in_flight_statuses():
    """0008's RunPython: on_my_way → accepted, awaiting_price_confirmation → quote_pending."""
    from importlib import import_module

    migration = import_module(
        "jobs.migrations.0008_remove_jobrequest_on_my_way_at_cancellationlog_kind_and_more"
    )
    from jobs.tests.factories import JobRequestFactory

    # Rows created post-migration can't hold the removed values, so write
    # them straight to the column to simulate pre-migration data.
    a = JobRequestFactory(status=JobRequest.Status.ACCEPTED)
    b = JobRequestFactory(status=JobRequest.Status.ACCEPTED)
    JobRequest.objects.filter(pk=a.pk).update(status="on_my_way")
    JobRequest.objects.filter(pk=b.pk).update(status="awaiting_price_confirmation")

    migration.remap_removed_statuses(_FakeApps(), None)

    a.refresh_from_db()
    b.refresh_from_db()
    assert a.status == JobRequest.Status.ACCEPTED
    assert b.status == JobRequest.Status.QUOTE_PENDING


class _FakeApps:
    """`apps.get_model('jobs', 'JobRequest')` for the RunPython under test."""

    def get_model(self, app_label, model_name):
        assert (app_label, model_name) == ("jobs", "JobRequest")
        return JobRequest
