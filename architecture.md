# Switchboard (CloudTask) — Architecture

## Component diagram
                          Internet
                             |
          +------------------+------------------+
          |                                      |
 +--------v--------+                  +----------v----------+
 |   CloudFront     |                  |  Application Load   |
 | (frontend, HTTPS)|                  |  Balancer (port 80) |
 +--------+---------+                  +----------+----------+
          |                                        |
 +--------v---------+                    +---------v---------+
 |   S3 (static      |                    |  ECS Fargate      |
 |   website origin)  |                    |  Service:          |
 |   frontend/index   |                    |  cloudtask-api     |
 |   .html             |                    |  (persistent,     |
 +---------------------+                    |  2+ subnets)       |
                                             +---------+----------+
                                                       |
                                              calls db.py / notify.py
                                                       |
          +--------------------------------------------+
          |                          |                          |
 +--------v--------+       +---------v---------+      +--------v--------+
 |   DynamoDB        |       |       SNS          |      |  CloudWatch     |
 | cloudTaskTasks     |       | CloudTaskReminders  |      |  Logs           |
 +---------------------+     +----------------------+      +-----------------+
                                        |
                               confirmed email
                               subscription
                                        |
                               +--------v--------+
                               |  Subscriber's    |
                               |  inbox            |
                               +-------------------+

 Separately, on an hourly schedule:

 +----------------+       +-------------------+
 |  EventBridge    | ----> |  ECS Fargate Task  | --> (same DynamoDB
 |  rate(1 hour)   |       |  cloudtask-notify   |      + SNS as above)
 +----------------+       +---------------------+

 All of the above sits inside one VPC (CloudTaskVPC, 10.0.0.0/16):
 public subnets (ALB, API service, scheduled task — no NAT Gateway,
 so public placement is deliberate, see "Networking" below) and a
 private subnet (reserved, currently unused pending a future NAT
 Gateway or VPC endpoints).

## Why this is a Cloud Computing project, not just a working app

Every major AWS building block is represented and genuinely used, not
just name-dropped: object/relational alternative (DynamoDB), pub/sub
messaging (SNS), containers (ECS Fargate, both scheduled and
persistent), networking (VPC, subnets, security groups, an ALB),
static hosting + CDN (S3, CloudFront), Infrastructure as Code
(CloudFormation), CI/CD (GitHub Actions), IAM least-privilege design,
and cost governance (AWS Budgets).

## Two ways into the same logic

`db.py` and `notify.py` are the single source of truth for storage
and notification logic. `cli.py` and `api.py` are two independent
front doors onto that same logic — a command-line tool and a REST
API — so the same task-management behavior is reachable by a
terminal or a browser, without duplicating any business logic.

## Sequence: adding a task via the web app

Browser CloudFront/S3 ALB API service DynamoDB
| | | | |
|--GET page----->| | | |
|<--HTML/JS------| | | |
| | |
|--POST /tasks (via ALB)------->|-------------->| |
| |--add_task()--->|
| |<--task---------|
|<--201 Created (task JSON)---------------------| |


## Sequence: scheduled notify

EventBridge ECS (Fargate task) DynamoDB SNS Inbox
| | | | |
|--rate(1 hour)------>| | | |
| |--list_tasks()------>| | |
| |<--tasks-------------| | |
| |--filter due-soon | | |
| |--publish(message)------------------>| |
| |<--MessageId--------------------------| |
| |
| confirmed email |
| subscription -->|


## Networking

`CloudTaskVPC` (10.0.0.0/16) contains:
- **PublicSubnet** and **PublicSubnet2** — two AZs, both with a route
  to the internet gateway. The ALB requires at least two AZs, hence
  the second subnet.
- **PrivateSubnet** — defined, currently unused. No NAT Gateway
  exists yet (deliberate cost/complexity tradeoff), so anything
  placed here would have no outbound internet access to reach
  DynamoDB/SNS public endpoints. Both the scheduled notify task and
  the API service run in the **public** subnets instead, each with a
  public IP — a documented, deliberate simplification, not an
  oversight. Tightening this (NAT Gateway, or VPC endpoints for
  DynamoDB/SNS) is a known next step, not yet done.
- **AlbSecurityGroup** — allows inbound port 80 from the internet.
- **ServiceSecurityGroup** — allows inbound port 5000 only from
  `AlbSecurityGroup` (not from the internet directly), and unrestricted
  outbound.

## Compute

- **`cloudtask-cluster`** — one ECS cluster, hosting two different
  kinds of workload:
  - **`cloudtask-notify`** task definition — run on-demand by
    EventBridge, once an hour, then exits. Not a long-running service.
  - **`cloudtask-api`** task definition — run as a persistent
    **Service** (`cloudtask-api-service`), desired count 1, registered
    behind the ALB's target group, health-checked at `/health`.

## Storage

**Table: `cloudTaskTasks`** — PK `user_id`, SK `task_id`. Attributes:
`title`, `description`, `status`, `due_date`, `priority`, `created_at`.

## IAM — two identities, deliberately separated

**`Dev-User`** — the operator identity, used for manual `aws`/
`cloudformation` work. Holds broad permissions across DynamoDB, SNS,
CloudWatch, ECR, CloudFormation, VPC/ECS/IAM/EventBridge provisioning,
ALB/S3/CloudFront, and AWS Budgets. Several of these use
`Resource: "*"` where AWS requires it for creation actions (you
cannot scope a permission to a VPC ID that doesn't exist yet).

**`cloudtask-ci`** — the CI/CD identity, used only by GitHub Actions
(`ci_policy.json`). Scoped to exactly three things:
`ecr:GetAuthorizationToken`; push permissions on the two specific
ECR repositories (`cloudtask`, `cloudtask-api`); and
`ecs:UpdateService`/`DescribeServices` on the one specific API
service ARN. It cannot create, modify, or delete any other resource —
no IAM, no VPC, no DynamoDB, no CloudFormation. If this credential
ever leaked, the blast radius is "someone could push a bad container
image," not "someone could tear down the account."

This split exists specifically because CI/CD credentials sit in a
different trust boundary than an operator's own credentials — a
compromised CI pipeline (a malicious dependency, a leaked secret in
a public repo) should not be able to do more than its actual job
requires.

## Cost governance

`MonthlyCostBudget` — an AWS Budget, $10/month, alerting by email at
80% actual spend. Exists so cost is monitored proactively rather than
discovered after the fact.

## CI/CD pipeline

`.github/workflows/deploy.yml`, triggered on push to `main`:
1. Run the full test suite (`test_db.py`, `test_notify.py`) —
   pipeline stops here on failure, nothing gets deployed
2. Build and push the CLI image (`Dockerfile`) to ECR
3. Build and push the API image (`Dockerfile.api`) to ECR
4. Force `cloudtask-api-service` to redeploy with the new image

The scheduled notify task needs no equivalent redeploy step — Fargate
pulls the current `:latest` image fresh on every scheduled run, so a
new push is picked up automatically on the next hourly trigger.

## Known limitations / honest tradeoffs

- No NAT Gateway or VPC endpoints — compute runs in public subnets
  with public IPs rather than fully private, for cost/complexity
  reasons within project scope.
- `iam_policy.json` (Dev-User's policy) is near AWS's 6144-byte
  managed-policy size cap — any further permission additions will
  require splitting it into a second managed policy.
- RDS (Week 6 of the original roadmap) was treated as optional and
  not implemented — DynamoDB alone covers the project's storage needs.