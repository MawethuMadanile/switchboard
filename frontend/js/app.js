const apiUrlInput = document.getElementById("api-url");
const addForm = document.getElementById("add-form");
const titleInput = document.getElementById("title");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const dueDateInput = document.getElementById("due-date");
const priorityInput = document.getElementById("priority");
const statusFilter = document.getElementById("status-filter");
const notifyBtn = document.getElementById("notify-btn");

const savedApiUrl =
    localStorage.getItem("cloudtask-api-url");


if (savedApiUrl && apiUrlInput) {
    apiUrlInput.value = savedApiUrl;
}

function apiBase() {

    return apiUrlInput.value
        .trim()
        .replace(/\/+$/, "");
}

function setConnectionStatus(connected) {

    if (!statusDot || !statusText) {
        return;
    }

    if (connected) {
        statusDot.classList.add("connected");
        statusText.textContent = "Cloud Connected";
    } else {
        statusDot.classList.remove("connected");
        statusText.textContent = "Cloud Disconnected";
    }
}

if (apiUrlInput) {

    apiUrlInput.addEventListener(
        "change",
        () => {

            const url =
                apiUrlInput.value.trim();

            localStorage.setItem(
                "cloudtask-api-url",
                url
            );

            if (url) {
                loadTasks();
            }

        }
    );
    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            loadTasks
        );

    }

}


async function loadTasks() {

    const base = apiBase();

    if (!base) {
        return;
    }

    try {

        const status = statusFilter
            ? statusFilter.value
            : "";

        const query = status
            ? `?status=${encodeURIComponent(status)}`
            : "";

        const response =
            await fetch(`${base}/tasks${query}`);

        const tasks =
            await response.json();

        setConnectionStatus(true);

        renderTasks(tasks);

    } catch (error) {

        console.error(
            "Failed to load tasks:",
            error
        );

        setConnectionStatus(false);

        taskList.innerHTML = `
            <li class="error-message">
                Unable to connect to the Cloud API.
            </li>
        `;

        updateTaskCount(0);
    }
}

function buildTaskMetaHtml(task) {

    const priority =
        task.priority || "medium";

    const dueDateHtml =
        task.due_date
        ? `<span>Due ${escapeHtml(task.due_date)}</span>`
        : "";

    return `
        <div class="task-meta">
            <span class="priority-badge priority-${priority}">
                ${priority}
            </span>
            ${dueDateHtml}
        </div>
    `;
}

function buildTaskActionsHtml(task) {

    const doneOrCompletedHtml =
        task.status !== "done"
        ? `
            <button
                class="done-btn"
                data-id="${task.task_id}"
            >
                DONE
            </button>
        `
        : `
            <span class="completed-label">
                COMPLETED
            </span>
        `;

    return `
        <div class="task-actions">

            ${doneOrCompletedHtml}

            <button
                class="delete-btn"
                data-id="${task.task_id}"
            >
                DELETE
            </button>

        </div>
    `;
}

function buildTaskItemHtml(task) {

    return `
        <div>
            <span class="task-title">
                ${escapeHtml(task.title)}
            </span>

            ${buildTaskMetaHtml(task)}
        </div>

        ${buildTaskActionsHtml(task)}
    `;
}

function wireTaskItemButtons(li, task) {

    const doneButton =
        li.querySelector(".done-btn");

    if (doneButton) {

        doneButton.addEventListener(
            "click",
            () => markDone(task.task_id)
        );

    }

    const deleteButton =
        li.querySelector(".delete-btn");

    deleteButton.addEventListener(
        "click",
        () => deleteTask(task.task_id)
    );
}

function renderTasks(tasks) {

    taskList.innerHTML = "";

    updateTaskCount(tasks.length);

    if (tasks.length === 0) {

        taskList.innerHTML = `
            <li class="empty-message">
                No tasks yet.
            </li>
        `;

        return;
    }

    tasks.forEach(task => {

        const li =
            document.createElement("li");

        li.className = "task-item";

        if (task.status === "done") {
            li.classList.add("done");
        }

        li.innerHTML = buildTaskItemHtml(task);

        wireTaskItemButtons(li, task);

        taskList.appendChild(li);

    });
}

function updateTaskCount(count) {

    if (!taskCount) {
        return;
    }

    taskCount.textContent =
        `${count} ${count === 1 ? "Task" : "Tasks"}`;
}

async function markDone(id) {

    const base = apiBase();

    if (!base) {
        return;
    }

    try {

        const response =
            await fetch(
                `${base}/tasks/${id}`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        status: "done"
                    })
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        await loadTasks();

    } catch (error) {

        console.error(
            "Failed to complete task:",
            error
        );

    }
}

    async function runNotifyCheck() {

        const base = apiBase();

        if (!base) {
            return;
        }

        const originalText = notifyBtn.textContent;
        notifyBtn.textContent = "CHECKING...";
        notifyBtn.disabled = true;

        try {

            const response =
                await fetch(`${base}/notify`, {
                    method: "POST"
                });

            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );

            }

            const result =
                await response.json();

            notifyBtn.textContent =
                `SENT ${result.sent}`;

        } catch (error) {

            console.error(
                "Notify check failed:",
                error
            );

            notifyBtn.textContent = "FAILED";

        } finally {

            setTimeout(() => {
                notifyBtn.textContent = originalText;
                notifyBtn.disabled = false;
            }, 2000);

        }
    }

    if (notifyBtn) {

        notifyBtn.addEventListener(
            "click",
            runNotifyCheck
        );

    }
async function deleteTask(id) {

    const base = apiBase();

    if (!base) {
        return;
    }

    try {

        const response =
            await fetch(
                `${base}/tasks/${id}`,
                {
                    method: "DELETE"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        await loadTasks();

    } catch (error) {

        console.error(
            "Failed to delete task:",
            error
        );

    }
}

function buildNewTaskPayload(title) {

    return {

        title: title,

        due_date: dueDateInput && dueDateInput.value
            ? dueDateInput.value
            : null,

        priority: priorityInput
            ? priorityInput.value
            : "medium"

    };
}

async function submitNewTask(base, payload) {

    const response =
        await fetch(
            `${base}/tasks`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify(payload)
            }
        );

    if (!response.ok) {

        throw new Error(
            `HTTP ${response.status}`
        );

    }

    return response;
}

function resetAddForm() {

    titleInput.value = "";

    if (dueDateInput) {
        dueDateInput.value = "";
    }
}

if (addForm) {

    addForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const title =
                titleInput.value.trim();

            const base =
                apiBase();

            if (!base || !title) {
                return;
            }

            try {

                const payload =
                    buildNewTaskPayload(title);

                await submitNewTask(base, payload);

                resetAddForm();

                await loadTasks();

            } catch (error) {

                console.error(
                    "Failed to add task:",
                    error
                );

            }

        }
    );


}

function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent = value;

    return div.innerHTML;
}

function wireScrollButtons(selector) {

    const buttons =
        document.querySelectorAll(selector);

    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const targetId =
                    button.dataset.target;

                const target =
                    document.getElementById(
                        targetId
                    );

                if (!target) {
                    return;
                }

                target.scrollIntoView({
                    behavior: "smooth"
                });

            }
        );

    });
}

wireScrollButtons(".feature-button");
wireScrollButtons(".nav-btn");

if (savedApiUrl) {
    loadTasks();
}