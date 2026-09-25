## Switchboard (CloudTask)

A cloud-native task manager built to demonstrate real AWS competency —
storage, networking, containers, a deployed web application, an
automated CI/CD pipeline, and security done properly. Originally built
as a CLI, then grown into a full deployed system over an 8-week
roadmap.

## What's actually running

- **DynamoDB** — task storage (`cloudTaskTasks` table)
- **SNS** — due-soon notifications, delivered by email
- **CloudWatch Logs** — logging for every component
- **VPC** — public and private subnets, routing, security groups,
  purpose-built for the containers below
- **ECS Fargate (scheduled task)** — `notify` runs hourly via
  EventBridge, entirely inside AWS, no laptop required
- **ECS Fargate (persistent service)** — a REST API (`api.py`,
  Flask) behind an Application Load Balancer
- **S3 + CloudFront** — the static frontend, served over HTTPS
- **GitHub Actions** — CI/CD: on every push to `main`, tests run,
  both Docker images build and push to ECR, and the API service
  redeploys automatically
- **AWS Budgets** — a monthly cost alert, so spend is monitored, not
  assumed safe

## Architecture

See `architecture.md` for the full diagram and component breakdown.

Short version: the CLI and the REST API both wrap the same `db.py`
and `notify.py` logic — one codebase, two ways in. The frontend talks
only to the API, never directly to AWS.

## Repo layout (flat, no package folder)

cli.py CLI entry point
api.py REST API (Flask)
db.py DynamoDB access layer
notify.py SNS notification logic
config.py environment-driven configuration
logging_setup.py CloudWatch logging setup
requirements.txt CLI dependencies
requirements-api.txt API dependencies
Dockerfile CLI container image
Dockerfile.api API container image
infra.yaml CloudFormation template — everything above
iam_policy.json Dev-User's IAM policy (manual/deploy work)
ci_policy.json cloudtask-ci's IAM policy (CI/CD only)
frontend/index.html static frontend
test_db.py, test_notify.py test suite
.github/workflows/ CI (tests) and CD (build + deploy)


## Local setup

```powershell
pip install -r requirements.txt
aws configure    # or set credentials another way
```

Environment variables (see `config.py` for defaults):

| Variable | Purpose |
|---|---|
| `CLOUD_REGION` | AWS region (default `us-east-1`) |
| `CLOUD_TABLE` | DynamoDB table name |
| `CLOUDTASK_SNS_TOPIC_ARN` | Required for `notify` |
| `CLOUDTASK_DUE_SOON_HOURS` | Notification window (default 24) |
| `CLOUDTASK_USER_ID` | Single-user default |

## CLI usage

python cli.py add "Finish report" --due 2026-07-10 --priority high
python cli.py list
python cli.py list --status pending
python cli.py update <task_id> --status done
python cli.py delete <task_id>
python cli.py notify


`task_id` must be the full UUID as shown by `list` — a truncated ID
silently no-ops instead of erroring.

## Running the API locally

```powershell
docker build -t cloudtask-api -f Dockerfile.api .
docker run --rm -p 5000:5000 cloudtask-api
curl http://localhost:5000/health
```

## Deploying infrastructure

Everything is defined in `infra.yaml`. Deploy or update the stack:

```powershell
aws cloudformation deploy `
  --template-file infra.yaml `
  --stack-name cloudtask-infra-test `
  --region us-east-1 `
  --parameter-overrides TableName=cloudTaskTasksTest TopicName=CloudTaskRemindersTest LogGroupName=/cloudtask/cli-test BudgetEmail=you@example.com `
  --capabilities CAPABILITY_NAMED_IAM
```

Outputs (ALB DNS name, CloudFront URL, etc.) are available via:

```powershell
aws cloudformation describe-stacks --stack-name cloudtask-infra-test --region us-east-1 --query "Stacks[0].Outputs"
```

## CI/CD

`.github/workflows/tests.yml` runs the test suite on every push/PR.

`.github/workflows/deploy.yml` runs on push to `main`: tests, then
builds and pushes both Docker images to ECR, then forces the API
service to redeploy with the new image. The scheduled `notify` task
picks up new images automatically on its next hourly run — no
redeploy step needed for it.

CI/CD authenticates as `cloudtask-ci`, a dedicated IAM identity
scoped to exactly two actions: push to the two ECR repos, and
redeploy the one API service. It cannot touch DynamoDB, the VPC, or
create/delete any infrastructure — that access is deliberately kept
separate, on `Dev-User`, for manual operator work only.

## Security notes

- Two separate IAM identities: `Dev-User` (broad, for
  infrastructure/deploy work) and `cloudtask-ci` (narrow, CI/CD only)
- All resource-scoped permissions use specific ARNs, not wildcards,
  except where AWS requires `Resource: "*"` for creation actions
  (a resource can't be scoped to an ID that doesn't exist yet)
- A monthly AWS Budget alert (`cloudtask-monthly-budget`) fires at
  80% of a $10 threshold

## Tests

pytest -v

WTC-89TLZYNT