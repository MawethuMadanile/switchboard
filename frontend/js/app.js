// ========================================
// CLOUDTASK — API + CINEMATIC NAVIGATION
// ========================================


// ========================================
// API ELEMENTS
// ========================================

const apiUrlInput = document.getElementById("api-url");
const addForm = document.getElementById("add-form");
const titleInput = document.getElementById("title");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");


// ========================================
// SAVED API URL
// ========================================

const savedApiUrl =
    localStorage.getItem("cloudtask-api-url");


if (savedApiUrl && apiUrlInput) {
    apiUrlInput.value = savedApiUrl;
}


// ========================================
// API BASE
// ========================================

function apiBase() {

    return apiUrlInput.value
        .trim()
        .replace(/\/+$/, "");
}


// ========================================
// SAVE API URL
// ========================================

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

}


// ========================================
// LOAD TASKS
// ========================================

async function loadTasks() {

    const base = apiBase();

    if (!base) {
        return;
    }

    try {

        const response =
            await fetch(`${base}/tasks`);

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }

        const tasks =
            await response.json();

        renderTasks(tasks);

    } catch (error) {

        console.error(
            "Failed to load tasks:",
            error
        );

        taskList.innerHTML = `
            <li class="error-message">
                Unable to connect to the Cloud API.
            </li>
        `;

        updateTaskCount(0);
    }
}


// ========================================
// RENDER TASKS
// ========================================

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

        li.className =
            "task-item";


        if (task.status === "done") {
            li.classList.add("done");
        }


        li.innerHTML = `
            <span class="task-title">
                ${escapeHtml(task.title)}
            </span>

            <div class="task-actions">

                ${
                    task.status !== "done"
                    ? `
                        <button
                            class="done-btn"
                            data-id="${task.id}"
                        >
                            DONE
                        </button>
                    `
                    : `
                        <span class="completed-label">
                            COMPLETED
                        </span>
                    `
                }

                <button
                    class="delete-btn"
                    data-id="${task.id}"
                >
                    DELETE
                </button>

            </div>
        `;


        const doneButton =
            li.querySelector(".done-btn");


        if (doneButton) {

            doneButton.addEventListener(
                "click",
                () => markDone(task.id)
            );

        }


        const deleteButton =
            li.querySelector(".delete-btn");


        deleteButton.addEventListener(
            "click",
            () => deleteTask(task.id)
        );


        taskList.appendChild(li);

    });
}


// ========================================
// TASK COUNT
// ========================================

function updateTaskCount(count) {

    if (!taskCount) {
        return;
    }

    taskCount.textContent =
        `${count} ${count === 1 ? "Task" : "Tasks"}`;
}


// ========================================
// MARK DONE
// ========================================

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


// ========================================
// DELETE
// ========================================

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


// ========================================
// ADD TASK
// ========================================

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

                const response =
                    await fetch(
                        `${base}/tasks`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                title: title
                            })
                        }
                    );


                if (!response.ok) {

                    throw new Error(
                        `HTTP ${response.status}`
                    );

                }


                titleInput.value = "";

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


// ========================================
// ESCAPE HTML
// ========================================

function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent = value;

    return div.innerHTML;
}


// ========================================
// CINEMATIC PAGE NAVIGATION
// ========================================

const pages =
    document.querySelectorAll(".page");


let currentPage = 0;


/*
    This prevents multiple wheel events from
    fighting with each other during a transition.
*/

let isTransitioning = false;


// ========================================
// GO TO PAGE
// ========================================

function goToPage(index) {

    if (
        index < 0 ||
        index >= pages.length
    ) {
        return;
    }


    if (isTransitioning) {
        return;
    }


    isTransitioning = true;


    /*
        Lock the destination before scrolling.
        This prevents the observer from changing
        currentPage halfway through the animation.
    */

    currentPage = index;


    const destination =
        pages[index].offsetTop;


    window.scrollTo({

        top: destination,

        behavior: "smooth"

    });


    /*
        Keep the transition locked until the
        smooth scroll has completely settled.
    */

    setTimeout(
        () => {

            window.scrollTo({
                top: destination,
                behavior: "auto"
            });

            isTransitioning = false;

        },
        950
    );
}


// ========================================
// MOUSE WHEEL NAVIGATION
// ========================================

window.addEventListener(
    "wheel",
    (event) => {

        /*
            Ignore tiny trackpad movements.
        */

        if (Math.abs(event.deltaY) < 20) {
            return;
        }


        /*
            Stop the browser's normal scrolling.
        */

        event.preventDefault();


        /*
            Ignore additional wheel events while
            the cinematic transition is happening.
        */

        if (isTransitioning) {
            return;
        }


        if (event.deltaY > 0) {

            goToPage(
                currentPage + 1
            );

        } else {

            goToPage(
                currentPage - 1
            );

        }

    },
    {
        passive: false
    }
);


// ========================================
// INTERSECTION OBSERVER
// ========================================

const observer =
    new IntersectionObserver(
        (entries) => {

            /*
                DO NOT update currentPage while
                a cinematic transition is happening.

                This is what prevents the page from
                jumping/bouncing backwards.
            */

            if (isTransitioning) {
                return;
            }


            entries.forEach(entry => {

                if (
                    entry.isIntersecting &&
                    entry.intersectionRatio >= 0.6
                ) {

                    const index =
                        Array.from(pages)
                            .indexOf(entry.target);


                    if (index !== -1) {

                        currentPage = index;

                    }

                }

            });

        },
        {
            threshold: [0.6]
        }
    );


pages.forEach(page => {
    observer.observe(page);
});


// ========================================
// BUILD / DEPLOY / SCALE BUTTONS
// ========================================

const featureButtons =
    document.querySelectorAll(
        ".feature-button"
    );


featureButtons.forEach(button => {

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


            const targetIndex =
                Array.from(pages)
                    .indexOf(target);


            if (targetIndex === -1) {
                return;
            }


            goToPage(targetIndex);

        }
    );

});


// ========================================
// KEYBOARD NAVIGATION
// ========================================

window.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "ArrowDown" ||
            event.key === "PageDown"
        ) {

            event.preventDefault();

            goToPage(
                currentPage + 1
            );

        }


        if (
            event.key === "ArrowUp" ||
            event.key === "PageUp"
        ) {

            event.preventDefault();

            goToPage(
                currentPage - 1
            );

        }

    }
);


// ========================================
// LOAD TASKS
// ========================================

if (savedApiUrl) {
    loadTasks();
}

