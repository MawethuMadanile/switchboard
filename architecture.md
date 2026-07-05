# CloudTask Architecture

## Component diagram

```
                      +-------------------+
                      |     CloudTask     |
                      |    CLI (click)    |
                      +---------+---------+
                                |
                +---------------+----------------+
                |                                 |
        +-------v-------+                 +-------v-------+
        |   db.py       |                 |  notify.py    |
        |  (boto3)      |                 |  (boto3)      |
        +-------+-------+                 +-------+-------+
                |                                 |
        +-------v-------+                 +-------v-------+
        |   DynamoDB    |                 |      SNS      |
        | cloudTaskTasks|                 |CloudTaskReminders|
        +---------------+                 +-------+-------+
                                                    |
                                            +-------v-------+
                                            |  Subscriber   |
                                            | (email/SMS)   |
                                            +---------------+

        All modules log through logging_setup.py -> CloudWatch
        Logs (/cloudtask/cli)
```

## Why this is a System Integration project, not just Cloud Computing

The CLI is a single client integrating two independent AWS systems
through separate, well-defined interfaces:

- `db.py` owns all DynamoDB access — task persistence
- `notify.py` owns all SNS access — task-due notifications

Neither module depends on the other's implementation, only on the
shared `Task` data shape. This is the integration boundary: `notify.py`
consumes data produced by `db.py` and pushes it into a completely
different system (SNS -> subscriber), with its own failure handling
that doesn't take down the storage layer if SNS is unavailable.

## Sequence: `cloudtask notify`

```
User          CLI           notify.py        db.py         DynamoDB        SNS
 |             |                |              |               |            |
 |--notify---->|                |              |               |            |
 |             |--publish_due_soon()----------->|               |            |
 |             |                |--list_tasks()------------------>|            |
 |             |                |<--tasks-------------------------|            |
 |             |                |--filter due-soon              |            |
 |             |                |--publish(message)---------------------------->|
 |             |                |<--MessageId-----------------------------------|
 |<--"Sent N notification(s)"---|                |               |            |
```

## Data model

**Table: `cloudTaskTasks`**

| Attribute | Type | Notes |
|---|---|---|
| `user_id` | String (PK) | supports multi-user in future |
| `task_id` | String (SK) | UUID |
| `title` | String | |
| `description` | String | |
| `status` | String | pending / in_progress / done |
| `due_date` | String | ISO 8601 |
| `priority` | String | low / medium / high |
| `created_at` | String | ISO 8601, set at creation |

## IAM

Least-privilege policy (`iam_policy.json`) scopes day-to-day
credentials to four statements: DynamoDB item-level CRUD on
`cloudTaskTasks`, `sns:Publish`/`sns:Subscribe` on `CloudTaskReminders`,
CloudWatch Logs write access under `/cloudtask/*`, and a separate
`OneTimeProvisioning` statement (`CreateTable`, `ListTables`,
`DescribeTable`, `CreateTopic`, `CreateLogGroup`) needed only for the
initial `setup_infra.py` run. In a larger deployment the provisioning
actions would sit on a separate admin identity; here the same IAM user
holds both, since this is a single-developer school project rather
than a multi-environment production setup.
