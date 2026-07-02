import os

AWS_REGION = os.environ.get("CLOUD_REGION", )
TABLE_NAME = os.environ.get("CLOUD_TABLE", )
SNS_TOPIC_ARN = os.environ.get("CLOUDTASK_SNS_TOPIC_ARN")
DUE_SOON_HOURS = int(os.environ.get("CLOUDTASK_DUE_SOON_HOURS", "24"))
DEFUALT_USER_ID = os.environ.get("CLOUDTASK_USER_ID", "defualt-user")