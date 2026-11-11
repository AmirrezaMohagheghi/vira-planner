const STORAGE_KEY = "vira-planner-tasks-v1";

const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const taskDate = document.querySelector("#task-date");
const taskTime = document.querySelector("#task-time");
const taskPriority = document.querySelector("#task-priority");
const taskCategory = document.querySelector("#task-category");
const submitTaskButton = document.querySelector("#submit-task");
const cancelEditButton = document.querySelector("#cancel-edit");
const taskList = document.querySelector("#task-list");
const totalCount = document.querySelector("#total-count");
const doneCount = document.querySelector("#done-count");
const leftCount = document.querySelector("#left-count");
const progressRing = document.querySelector("#progress-ring");
const progressPercent = document.querySelector("#progress-percent");
const progressCaption = document.querySelector("#progress-caption");
const focusButton = document.querySelector("#focus-button");

const priorityLabels = {
  high: "زیاد",
  medium: "متوسط",
  low: "کم"
};

const categoryLabels = {
  personal: "شخصی",
  study: "درس و مطالعه",
  university: "دانشگاه",
  work: "کار",
  worship: "عبادت",
  other: "سایر"
};

let tasks = loadTasks();
let editingTaskId = null;

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

function getTodayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTaskDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
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
    progressCaption.textContent = `${toPersianDigits(left)} کار تا پایان فهرست باقی مانده.`;
  }
}

function resetTaskForm() {
  taskForm.reset();
  editingTaskId = null;
  submitTaskButton.textContent = "افزودن کار";
  cancelEditButton.hidden = true;
}

function startEditingTask(task) {
  editingTaskId = task.id;
  taskInput.value = task.title;
  taskDate.value = task.date || "";
  taskTime.value = task.time || "";
  taskPriority.value = task.priority || "medium";
  taskCategory.value = task.category || "personal";
  submitTaskButton.textContent = "ذخیرهٔ تغییرات";
  cancelEditButton.hidden = false;
  taskForm.scrollIntoView({ behavior: "smooth", block: "center" });
  taskInput.focus();
}

function createMetaChip(text, extraClass = "") {
  const chip = document.createElement("span");
  chip.className = `meta-chip ${extraClass}`.trim();
  chip.textContent = text;
  return chip;
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
    checkbox.checked = Boolean(task.done);
    checkbox.setAttribute("aria-label", "تغییر وضعیت کار");
    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      saveTasks();
      renderTasks();
    });

    const main = document.createElement("div");
    main.className = "task-main";

    const label = document.createElement("span");
    label.className = "task-text";
    label.textContent = task.title;
    main.append(label);

    const meta = document.createElement("div");
    meta.className = "task-meta";

    if (task.date) meta.append(createMetaChip(`📅 ${formatTaskDate(task.date)}`));
    if (task.time) meta.append(createMetaChip(`◷ ${task.time}`));

    const priority = task.priority || "medium";
    meta.append(createMetaChip(`اولویت: ${priorityLabels[priority] || "متوسط"}`, `priority-${priority}`));
    const category = task.category || "personal";
    meta.append(createMetaChip(categoryLabels[category] || "شخصی"));

    if (meta.childElementCount) main.append(meta);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "edit-task";
    editButton.textContent = "✎";
    editButton.title = "ویرایش کار";
    editButton.setAttribute("aria-label", `ویرایش ${task.title}`);
    editButton.addEventListener("click", () => startEditingTask(task));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "delete-task";
    removeButton.textContent = "×";
    removeButton.title = "حذف کار";
    removeButton.setAttribute("aria-label", `حذف ${task.title}`);
    removeButton.addEventListener("click", () => {
      tasks = tasks.filter((entry) => entry.id !== task.id);
      if (editingTaskId === task.id) resetTaskForm();
      saveTasks();
      renderTasks();
    });

    item.append(checkbox, main, editButton, removeButton);
    taskList.append(item);
  });

  updateProgress();
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) return;

  const taskDetails = {
    title,
    date: taskDate.value,
    time: taskTime.value,
    priority: taskPriority.value,
    category: taskCategory.value
  };

  if (editingTaskId) {
    const task = tasks.find((entry) => entry.id === editingTaskId);
    if (task) Object.assign(task, taskDetails);
  } else {
    tasks.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ...taskDetails,
      done: false
    });
  }

  saveTasks();
  renderTasks();
  resetTaskForm();
  taskInput.focus();
});

cancelEditButton.addEventListener("click", resetTaskForm);

focusButton.addEventListener("click", () => {
  taskInput.focus();
  document.querySelector("#tasks").scrollIntoView({ behavior: "smooth", block: "center" });
});

showToday();
renderTasks();