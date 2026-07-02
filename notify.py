import logging
import boto3
import config, db
from datetime import datetime, timedelta, timezone
from botocore.exceptions import ClientError
logger = logging.getLogger("cloudtask.notify")

_sns = boto3.client("sns", region_name = config.AWS_REGION)


def _is_due_soon(task):
    due_date = task.get("due_date")
    if not due_date:
        return False
    try:
        due = datetime.fromisoformat(due_date)
    except ValueError:
        return False
    if due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)
    window = datetime.now(timezone.utc) + timedelta(hours=config.DUE_SOON_HOURS)
    return due <= window and task.get("status") != "done"

def publish_due_soon():
    if not config.SNS_TOPIC_ARN:
        logger.error("CLOUDTASK_SNS_TOPIC_ARN not set... skipping.")
        return []
    
    due_tasks = [t for t in db.list_tasks(user_id) if _is_due_soon(t)]
    sent = []
    for task in due_tasks:
        message = f"Task due soon: {task["title"]} (due {task["due_date"]})"
        try: 
            _sns.publish(
                TopicArn= config.SNS_TOPIC_ARN,
                Subject= "CloudTask reminder",
                Message=message,
            )
            sent.append(task["task_id"])
            logger.info("Notified for task %s", task["task_id"])
        except ClientError as e:
            logger.error("SNS publish failed for %s: %s", task["task_id"], e)
    return sent