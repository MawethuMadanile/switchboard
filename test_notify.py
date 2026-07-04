from datetime import datetime, timedelta,timezone
from notify import _is_due_soon

def _task(due_offset_hours, status="pending"):
    due = datetime.now(timezone.utc) + timedelta(hours=due_offset_hours)
    return {"due_date": due.isoformat(), "status": status}


def test_task_due_soon_is_flagged():
    assert _is_due_soon(_task(2)) is True


def test_task_far_in_future_not_flagged():
    assert _is_due_soon(_task(200)) is False


def test_done_task_never_flagged():
    assert _is_due_soon(_task(2, status="done")) is False


def test_task_without_due_date_not_flagged():
    assert _is_due_soon({"status": "pending"}) is False
