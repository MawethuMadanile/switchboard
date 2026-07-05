# CloudTask

A CLI task manager backed by AWS DynamoDB, with SNS notifications and
CloudWatch logging. Built as a combined Cloud Computing / System
Integration elective project.

## Architecture

- **Storage**: DynamoDB table `cloudTaskTasks` (PK `user_id`, SK `task_id`)
- **Integration point**: SNS topic `CloudTaskReminders`, published to by
  `notify` for tasks due within `CLOUDTASK_DUE_SOON_HOURS`
- **Observability**: CloudWatch log group `/cloudtask/cli`
- **No Lambda** — all logic runs in the CLI process via boto3

See `architecture.md` for the full diagram and integration flow.

## Setup

1. Get AWS credentials configured for whichever IAM user you're using
   (this project used an existing user, `Dev-User`, rather than
   creating a new one — either works).
2. Attach the permissions in `iam_policy.json` to that user (replace
   `472706939265` with your own AWS account ID first):
   ```
   aws iam put-user-policy --user-name <your-user> --policy-name CloudTaskAccess --policy-document file://iam_policy.json
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Provision infra (DynamoDB table, SNS topic, log group):
   ```
   python setup_infra.py
   ```
5. Set the SNS topic ARN printed by the script above:
   ```
   $env:CLOUDTASK_SNS_TOPIC_ARN = "arn:aws:sns:us-east-1:<account-id>:CloudTaskReminders"
   ```
   (PowerShell — use `export` instead on macOS/Linux)
6. (Optional, for email notifications) Subscribe an email address to
   the topic and confirm it via the link AWS emails you:
   ```
   aws sns subscribe --topic-arn <topic-arn> --protocol email --notification-endpoint you@example.com
   ```

## Usage

```
python cli.py add "Finish report" --due 2026-07-10 --priority high
python cli.py list
python cli.py list --status pending
python cli.py update <task_id> --status done
python cli.py delete <task_id>
python cli.py notify
```

Note: `task_id` must be the full UUID as shown by `list` — not a
truncated or partial value, or the command will silently no-op instead
of erroring.

## Tests

```
pytest test_notify.py
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `CLOUD_REGION` | `us-east-1` | AWS region |
| `CLOUDTASK_TABLE` | `cloudTaskTasks` | DynamoDB table name |
| `CLOUDTASK_SNS_TOPIC_ARN` | — | Required for `notify` |
| `CLOUDTASK_DUE_SOON_HOURS` | `24` | Notification window |
| `CLOUDTASK_USER_ID` | `default-user` | Single-user default |
