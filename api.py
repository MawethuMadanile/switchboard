"""
CloudTask REST API — thin Flask wrapper around db.py and notify.py, so
the same logic the CLI uses is also reachable over HTTP. This is what
runs as a persistent ECS service behind the load balancer.
"""
from flask import Flask, jsonify, request
from flask_cors import CORS

import db
import notify as notify_mod

app = Flask(__name__)
CORS(app)  # allow the S3/CloudFront-hosted frontend to call this API


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/tasks", methods=["GET"])
def list_tasks():
    status = request.args.get("status")
    tasks = db.list_tasks(status=status)
    return jsonify(tasks)


@app.route("/tasks", methods=["POST"])
def add_task():
    body = request.get_json(force=True) or {}
    title = body.get("title")
    if not title:
        return jsonify({"error": "title is required"}), 400
    task = db.add_task(
        title=title,
        description=body.get("description", ""),
        due_date=body.get("due_date"),
        priority=body.get("priority", "medium"),
    )
    return jsonify(task), 201


@app.route("/tasks/<task_id>", methods=["PATCH"])
def update_task(task_id):
    body = request.get_json(force=True) or {}
    fields = {k: v for k, v in body.items()
              if k in ("title", "status", "priority", "due_date")}
    if not fields:
        return jsonify({"error": "no updatable fields provided"}), 400
    result = db.update_task(task_id, **fields)
    if result is None:
        return jsonify({"error": "task not found or no fields changed"}), 404
    return jsonify(result)


@app.route("/tasks/<task_id>", methods=["DELETE"])
def delete_task(task_id):
    db.delete_task(task_id)
    return "", 204


@app.route("/notify", methods=["POST"])
def notify():
    sent = notify_mod.publish_due_soon()
    return jsonify({"sent": len(sent), "task_ids": sent})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)