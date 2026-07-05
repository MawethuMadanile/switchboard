import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__),".."))

import boto3
from botocore.exceptions import ClientError
import config


def create_table():
    dynamodb = boto3.client("dynamodb", region_name= config.AWS_REGION)
    try:
        dynamodb.create_table(
            TableName=config.TABLE_NAME,
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
        print(f"Creating table {config.TABLE_NAME}... waiting for Active State")
        dynamodb.get_waiter("table_exists").wait(TableName=config.TABLE_NAME)
        print(f"Table {config.TABLE_NAME} is active.")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceInUseException":
            print(f"Table {config.TABLE_NAME} already exists... Skipping.")
        else:
            raise

def create_sns_topic():
    sns = boto3.client("sns", region_name= config.AWS_REGION)
    resp = sns.create_topic(Name="CloudTaskReminders")
    topic_arn = resp["TopicArn"]
    print(f"SNS topic ready: {topic_arn}")
    print("Set this as CLOUDTASK_SNS_TOPIC_ARN in your environment.")
    return topic_arn

def create_log_group():
    logs = boto3.client("logs", region_name= config.AWS_REGION)
    try:
        logs.create_log_group(logGroupName="/cloudtask/cli")
        print("Log group /cloudtask/cli created.")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourcesAlreadyExistsException":
            print("Log group /cloudtask/cli already exists... skipping.")
        else:
            raise
        
if __name__ == "__main__":
    create_table()
    create_sns_topic()
    create_log_group()