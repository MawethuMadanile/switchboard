"""
Tests for db.py against a mocked DynamoDB table (via moto) — no real
AWS calls, no credentials needed, safe to run in CI.

db.py creates its boto3 table resource at import time, so the module
has to be (re)imported *after* the mock is active and the fake table
exists, or it'll bind to a table that was never created.
"""
import importlib
import os

import boto3
import pytest
from moto import mock_aws

os.environ.setdefault("CLOUD_REGION", "us-east-1")
os.environ.setdefault("CLOUDTASK_TABLE", "cloudTaskTasks")

TABLE_NAME = "cloudTaskTasks"
REGION = "us-east-1"


@pytest.fixture
def db_module():
    with mock_aws():
        client = boto3.client("dynamodb", region_name=REGION)
        client.create_table(
            TableName=TABLE_NAME,
            KeySchema=[
                {"AttributeName": "user_id", "KeyType": "HASH"},
                {"AttributeName": "task_id", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "user_id", "AttributeType": "S"},
                {"AttributeName": "task_id", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )

        import db as db_mod
        importlib.reload(db_mod)  # rebind _table to the mocked resource

        yield db_mod


def test_add_task_creates_item(db_module):
    task = db_module.add_task(title="Write tests", priority="high")
    assert task["title"] == "Write tests"
    assert task["priority"] == "high"
    assert task["status"] == "pending"
    assert "task_id" in task


def test_list_tasks_returns_added_task(db_module):
    db_module.add_task(title="Task A")
    db_module.add_task(title="Task B")
    tasks = db_module.list_tasks()
    titles = {t["title"] for t in tasks}
    assert titles == {"Task A", "Task B"}


def test_list_tasks_filters_by_status(db_module):
    added = db_module.add_task(title="Filter me")
    db_module.update_task(added["task_id"], status="done")
    db_module.add_task(title="Still pending")

    done_tasks = db_module.list_tasks(status="done")
    pending_tasks = db_module.list_tasks(status="pending")

    assert len(done_tasks) == 1
    assert done_tasks[0]["title"] == "Filter me"
    assert len(pending_tasks) == 1
    assert pending_tasks[0]["title"] == "Still pending"


def test_update_task_returns_updated_attributes(db_module):
    task = db_module.add_task(title="Original title")
    result = db_module.update_task(task["task_id"], title="New title",
                                    status="in_progress")
    assert result["title"] == "New title"
    assert result["status"] == "in_progress"


def test_update_task_with_no_fields_returns_none(db_module):
    task = db_module.add_task(title="Untouched")
    result = db_module.update_task(task["task_id"])
    assert result is None


def test_delete_task_removes_item(db_module):
    task = db_module.add_task(title="Delete me")
    db_module.delete_task(task["task_id"])
    remaining = db_module.list_tasks()
    assert all(t["task_id"] != task["task_id"] for t in remaining)


def test_delete_nonexistent_task_does_not_raise(db_module):
    # DynamoDB delete_item is a no-op on a missing key — confirms this
    # doesn't raise, since silent no-ops here have bitten us before
    # (see: the task_id truncation bug in list_cmd).
    db_module.delete_task("this-id-does-not-exist")