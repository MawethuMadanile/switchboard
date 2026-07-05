"""
CloudTask CLI — entry point.

Usage:
    python cli.py add "Finish report" --due 2026-07-10 --priority high
    python cli.py list [--status pending]
    python cli.py update <task_id> --status done
    python cli.py delete <task_id>
    python cli.py notify
"""
import click

import db
import notify as notify_mod
from logging_setup import configure_logging

logger = configure_logging()


@click.group()
def cli():
    """CloudTask — a DynamoDB-backed task manager."""
    pass


@cli.command()
@click.argument("title")
@click.option("--description", default="", help="Longer task description")
@click.option("--due", default=None, help="Due date, ISO format e.g. 2026-07-10")
@click.option("--priority", default="medium",
              type=click.Choice(["low", "medium", "high"]))
def add(title, description, due, priority):
    """Add a new task."""
    task = db.add_task(title=title, description=description,
                        due_date=due, priority=priority)
    logger.info("Added task %s", task["task_id"])
    click.echo(f"Added task {task['task_id']}: {task['title']}")


@cli.command(name="list")
@click.option("--status", default=None,
              type=click.Choice(["pending", "in_progress", "done"]))
def list_cmd(status):
    """List tasks, optionally filtered by status."""
    tasks = db.list_tasks(status=status)
    if not tasks:
        click.echo("No tasks found.")
        return
    for t in tasks:
        click.echo(f"[{t['status']:^11}] {t['task_id']}  {t['title']}"
                    f"  (due {t.get('due_date', '—')}, priority {t['priority']})")


@cli.command()
@click.argument("task_id")
@click.option("--status", default=None,
              type=click.Choice(["pending", "in_progress", "done"]))
@click.option("--title", default=None)
@click.option("--priority", default=None,
              type=click.Choice(["low", "medium", "high"]))
def update(task_id, status, title, priority):
    """Update fields on an existing task."""
    fields = {k: v for k, v in
              {"status": status, "title": title, "priority": priority}.items()
              if v is not None}
    if not fields:
        click.echo("Nothing to update — pass --status, --title or --priority.")
        return
    result = db.update_task(task_id, **fields)
    if result is None:
        click.echo("Task not found.")
        return
    logger.info("Updated task %s: %s", task_id, fields)
    click.echo(f"Updated {task_id}: {fields}")


@cli.command()
@click.argument("task_id")
def delete(task_id):
    """Delete a task."""
    db.delete_task(task_id)
    logger.info("Deleted task %s", task_id)
    click.echo(f"Deleted {task_id}")


@cli.command()
def notify():
    """Check for tasks due soon and publish SNS notifications."""
    sent = notify_mod.publish_due_soon()
    click.echo(f"Sent {len(sent)} notification(s).")


if __name__ == "__main__":
    cli()