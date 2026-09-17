# CloudTask — Terminal Command Reference

Every command type used across this project, grouped by tool, with what
each one does. Commands are shown as patterns — swap in your actual
values (table names, ARNs, IDs) where relevant.

---

## Python / testing

```powershell
python cli.py <command>
```
Runs the CLI directly (add, list, update, delete, notify).

```powershell
pytest -v
pytest test_db.py -v
```
Runs the test suite. `-v` shows each test by name, not just a pass/fail count.

```powershell
pip install -r requirements.txt
pip install "moto[dynamodb]"
```
Installs project dependencies. `moto` fakes AWS services in memory so
tests don't touch real infrastructure.

---

## Docker

```powershell
docker build -t cloudtask .
docker build -t cloudtask-api -f Dockerfile.api .
```
Builds an image from a Dockerfile. `-t` names the image. `-f` points
at a specific Dockerfile when it's not just named `Dockerfile`.

```powershell
docker run --rm cloudtask --help
docker run --rm -p 5000:5000 cloudtask-api
```
Runs a container from an image. `--rm` deletes the container once it
stops. `-p 5000:5000` maps your machine's port 5000 to the
container's port 5000.

```powershell
docker tag cloudtask:latest 472706939265.dkr.ecr.us-east-1.amazonaws.com/cloudtask:latest
```
Labels a local image with the full ECR repository path it needs before pushing.

```powershell
docker push 472706939265.dkr.ecr.us-east-1.amazonaws.com/cloudtask:latest
```
Uploads a tagged image to ECR.

```powershell
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 472706939265.dkr.ecr.us-east-1.amazonaws.com
```
Authenticates Docker against ECR so `push`/`pull` are allowed.

---

## AWS — identity & account

```powershell
aws sts get-caller-identity
```
Shows which AWS identity you're currently authenticated as, and your account ID.

```powershell
aws configure --profile cloudtask
```
Sets up a named credential profile interactively (access key, secret, region).

---

## AWS — IAM (permissions)

```powershell
aws iam create-policy --policy-name CloudTaskAccess --policy-document file://iam_policy.json
```
Creates a new **managed** policy from a JSON file (one-time — after this, use `create-policy-version` to update it).

```powershell
aws iam attach-user-policy --user-name Dev-User --policy-arn arn:aws:iam::472706939265:policy/CloudTaskAccess
```
Attaches a managed policy to a user.

```powershell
aws iam list-policy-versions --policy-arn arn:aws:iam::472706939265:policy/CloudTaskAccess
```
Lists every saved version of a managed policy (max 5 kept at once).

```powershell
aws iam delete-policy-version --policy-arn arn:aws:iam::472706939265:policy/CloudTaskAccess --version-id v3
```
Deletes one old policy version — required before creating a 6th, since AWS caps managed policies at 5 versions.

```powershell
aws iam create-policy-version --policy-arn arn:aws:iam::472706939265:policy/CloudTaskAccess --policy-document file://iam_policy.json --set-as-default
```
Pushes an updated policy document as the new active version.

```powershell
aws iam get-user-policy --user-name Dev-User --policy-name CloudTaskAccess
```
Shows the content of an **inline** policy attached directly to a user (used early on, before switching to a managed policy).

```powershell
aws iam put-user-policy --user-name Dev-User --policy-name CloudTaskAccess --policy-document file://iam_policy.json
```
Creates or overwrites an inline user policy. (Capped at 2048 bytes — this project outgrew it and switched to a managed policy instead.)

```powershell
aws iam delete-user-policy --user-name Dev-User --policy-name CloudTaskAccess
```
Removes an inline policy from a user (used to clean up after switching to the managed-policy approach).

---

## AWS — DynamoDB

```powershell
aws dynamodb list-tables --region us-east-1
```
Lists every table in the account/region — useful as a quick permissions check.

```powershell
aws dynamodb put-item --table-name cloudTaskTasksTest --item '{...}' --region us-east-1
```
Manually inserts one item into a table, bypassing the app code — used for testing.

---

## AWS — SNS

```powershell
aws sns subscribe --topic-arn <topic-arn> --protocol email --notification-endpoint you@example.com
```
Subscribes an email address to a topic (requires clicking a confirmation link AWS emails you).

---

## AWS — ECR (container registry)

```powershell
aws ecr create-repository --repository-name cloudtask --region us-east-1
```
Creates a new private repository to hold Docker images.

---

## AWS — CloudFormation (infrastructure as code)

```powershell
aws cloudformation deploy --template-file infra.yaml --stack-name cloudtask-infra-test --region us-east-1 --parameter-overrides TableName=... TopicName=... LogGroupName=... --capabilities CAPABILITY_NAMED_IAM
```
Creates or updates a stack from a template. `--parameter-overrides`
supplies values for the template's `Parameters:` section.
`--capabilities CAPABILITY_NAMED_IAM` is required whenever the
template creates IAM roles with explicit names.

```powershell
aws cloudformation describe-stacks --stack-name cloudtask-infra-test --region us-east-1
```
Shows a stack's current status and outputs. Errors with "does not
exist" once a stack is fully deleted — the standard way to confirm
cleanup finished.

```powershell
aws cloudformation describe-stacks --stack-name cloudtask-infra-test --region us-east-1 --query "Stacks[0].Outputs"
```
Same as above, filtered to just the `Outputs:` block — the actual
resource names/ARNs/IDs the template produced.

```powershell
aws cloudformation describe-stack-events --stack-name cloudtask-infra-test --region us-east-1
```
Lists every event during a stack's create/update/delete — the primary
way to find out *which* resource failed and why.

```powershell
aws cloudformation delete-stack --stack-name cloudtask-infra-test --region us-east-1
```
Deletes a stack and everything it created. Doesn't wait for
completion — pair with `describe-stacks` to confirm it finished.

---

## AWS — ECS (running containers)

```powershell
aws ecs run-task --cluster cloudtask-cluster --task-definition cloudtask-notify --launch-type FARGATE --network-configuration "awsvpcConfiguration={subnets=[...],securityGroups=[...],assignPublicIp=ENABLED}" --region us-east-1
```
Manually launches one instance of a task definition immediately — used to test a scheduled task without waiting for its timer.

```powershell
aws ecs list-tasks --cluster cloudtask-cluster --region us-east-1
```
Shows currently running tasks in a cluster.

```powershell
aws ecs describe-tasks --cluster cloudtask-cluster --tasks <task-arn> --region us-east-1 --query "tasks[0].lastStatus"
```
Checks one task's current status (`PROVISIONING`, `RUNNING`, `STOPPED`, etc.).

---

## AWS — CloudWatch Logs

```powershell
aws logs tail /cloudtask/cli-test --region us-east-1
aws logs tail /cloudtask/cli-test --region us-east-1 --since 5m
```
Shows recent log output from a log group — the way to see what
actually happened inside a container that already finished running.
`--since` limits the window so old runs don't clutter the output.

---

## PowerShell utilities (not AWS/Docker specific)

```powershell
dir
dir requirements*
```
Lists files in the current folder, optionally filtered by a pattern.

```powershell
Get-Content iam_policy.json
Get-Content infra.yaml | Select-Object -Skip 440 -First 20
```
Prints a file's contents. `Select-Object -Skip N -First M` shows a
specific slice of lines — useful for jumping to one part of a long file.

```powershell
(Get-Content iam_policy.json -Raw).Length
```
Shows a file's total character count — used to check against AWS's
policy size limits before trying to save.

```powershell
Get-Content ... | Select-String "CREATE_FAILED" -Context 0,10
```
Searches text output for a specific string, showing lines of context
around each match — used to jump straight to failures in long
CloudFormation event logs.

```powershell
Rename-Item "old-name.txt" "new-name.txt"
```
Renames a file.

```powershell
Remove-Item infra.yaml
```
Deletes a file.

```powershell
notepad infra.yaml
```
Opens (or creates, if it doesn't exist) a file in Notepad.

```powershell
Get-Location
```
Shows which folder PowerShell is currently in.