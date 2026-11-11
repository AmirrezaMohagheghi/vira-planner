const STORAGE_KEY = "vira-planner-tasks-v1";

const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const taskList = document.querySelector("#task-list");
const totalCount = document.querySelector("#total-count");
const doneCount = document.querySelector("#done-count");
const leftCount = document.querySelector("#left-count");
const progressRing = document.querySelector("#progress-ring");
const progressPercent = document.querySelector("#progress-percent");
const progressCaption = document.querySelector("#progress-caption");
const focusButton = document.querySelector("#focus-button");

let tasks = loadTasks();

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function toPersianDigits(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function showToday() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(now);
  document.querySelector("#today-date").textContent = date;
  document.querySelector("#task-date-label").textContent =
    new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      day: "numeric",
      month: "long"
    }).format(now);
}

function updateProgress() {
  const total = tasks.length;
  const done = tasks.filter((task) => task.done).length;
  const left = total - done;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  totalCount.textContent = toPersianDigits(total);
  doneCount.textContent = toPersianDigits(done);
  leftCount.textContent = toPersianDigits(left);
  progressPercent.textContent = toPersianDigits(percent) + "٪";
  progressRing.style.background =
    `conic-gradient(var(--accent) ${percent}%, #28354a ${percent}%)`;

  if (total === 0) {
    progressCaption.textContent = "با یک کار کوچک شروع کن.";
  } else if (percent === 100) {
    progressCaption.textContent = "همهٔ کارها انجام شد؛ دمت گرم! 🎉";
  } else {
    progressCaption.textContent = `${toPersianDigits(left)} کار تا پایان فهرست امروز باقی مانده.`;
  }
}

function renderTasks() {
  taskList.replaceChildren();

  if (tasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "هنوز کاری ثبت نکردی. اولین قدم رو اضافه کن.";
    taskList.append(empty);
    updateProgress();
    return;
  }

  tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item${task.done ? " completed" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", "تغییر وضعیت کار");
    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      saveTasks();
      renderTasks();
    });

    const label = document.createElement("span");
    label.className = "task-text";
    label.textContent = task.title;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "delete-task";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", "حذف کار");
    removeButton.addEventListener("click", () => {
      tasks = tasks.filter((entry) => entry.id !== task.id);
      saveTasks();
      renderTasks();
    });

    item.append(checkbox, label, removeButton);
    taskList.append(item);
  });

  updateProgress();
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) return;

  tasks.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    done: false
  });

  saveTasks();
  renderTasks();
  taskInput.value = "";
  taskInput.focus();
});

focusButton.addEventListener("click", () => {
  taskInput.focus();
  document.querySelector("#tasks").scrollIntoView({ behavior: "smooth", block: "center" });
});

showToday();
renderTasks();