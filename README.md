# CloudTask

A CLI task manager backed by AWS DynamoDB, with SNS notifications and
CloudWatch logging. Built as a combined Cloud Computing / System
Integration elective project.

## Architecture

- **Storage**: DynamoDB table `CloudTaskTasks` (PK `user_id`, SK `task_id`)
- **Integration point**: SNS topic `CloudTaskReminders`, published to by
  `cloudtask notify` for tasks due within `CLOUDTASK_DUE_SOON_HOURS`
- **Observability**: CloudWatch log group `/cloudtask/cli`
- **No Lambda** — all logic runs in the CLI process via boto3

See `docs/architecture.md` for the full diagram and integration flow.

## Setup

1. Create an IAM user with the policy in `infra/iam_policy.json`
   (replace `ACCOUNT_ID` with your AWS account ID first).
2. Configure credentials:
   ```
   aws configure --profile cloudtask
   export AWS_PROFILE=cloudtask
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Provision infra (DynamoDB table, SNS topic, log group):
   ```
   python infra/setup_infra.py
   ```
5. Set the SNS topic ARN printed by the script above:
   ```
   export CLOUDTASK_SNS_TOPIC_ARN=arn:aws:sns:af-south-1:...:CloudTaskReminders
   ```

## Usage

```
python -m cloudtask.cli add "Finish report" --due 2026-07-10 --priority high
python -m cloudtask.cli list
python -m cloudtask.cli list --status pending
python -m cloudtask.cli update <task_id> --status done
python -m cloudtask.cli delete <task_id>
python -m cloudtask.cli notify
```

## Tests

```
pytest tests/
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `CLOUDTASK_REGION` | `af-south-1` | AWS region |
| `CLOUDTASK_TABLE` | `CloudTaskTasks` | DynamoDB table name |
| `CLOUDTASK_SNS_TOPIC_ARN` | — | Required for `notify` |
| `CLOUDTASK_DUE_SOON_HOURS` | `24` | Notification window |
| `CLOUDTASK_USER_ID` | `default-user` | Single-user default |