import uuid
from datetime import datetime, timezone
import boto3
import config

_dynamodb = boto3.resource("dynamodb", region_name= config.AWS_REGION)
_table = _dynamodb.Table(config.TABLE_NAME) # type: ignore[attr-defined]

def add_task(title, description = "", due_date=None, priority="medium",user_id=config.DEFAULT_USER_ID):
    task = {
        "user_id": user_id,
        "task_id": str(uuid.uuid4()),
        "title": title,
        "description": description,
        "status": "pending",
        "due_date": due_date,
        "priority": priority,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _table.put_item(Item=task)
    return task

def list_tasks(user_id=config.DEFAULT_USER_ID, status=None):
    resp = _table.query(
    KeyConditionExpression = "user_id = :uid",
    ExpressionAttributeValues={":uid": user_id},
    )
    items = resp.get("Items", [])
    if status:
        items = [i for i in items if i.get("status") == status]
    return items
    
def update_task(task_id, user_id=config.DEFAULT_USER_ID, **fields):
    if not fields:
        return None
    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in fields)
    names = {f"#{k}": k for k in fields}
    values = {f":{k}": v for k, v in fields.items()}
    resp = _table.update_item(
        Key={"user_id": user_id, "task_id": task_id},
        UpdateExpression = expr,
        ExprssionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues= "ALL_NEW",
    )
    return resp.get("Attributes")

def delete_task(task_id, user_id=config.DEFAULT_USER_ID):
    _table.delete_item(Key={"user_id": user_id, "task_id": task_id})
