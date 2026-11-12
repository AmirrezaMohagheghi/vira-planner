import { loadTasks, saveTasks } from "./src/infrastructure/storage/local-task-storage.js";
import { createTaskForUI, updateTaskForUI } from "./src/application/tasks/task-use-cases.js";

const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const taskDate = document.querySelector("#task-date");
const taskTime = document.querySelector("#task-time");
const taskTimeHour = document.querySelector("#task-time-hour");
const taskTimeMinute = document.querySelector("#task-time-minute");

function updateTaskTimeValue() {
  const hourEmpty = taskTimeHour.value === "";
  const minuteEmpty = taskTimeMinute.value === "";
  taskTimeHour.setCustomValidity("");
  taskTimeMinute.setCustomValidity("");

  if (hourEmpty && minuteEmpty) {
    taskTime.value = "";
    return;
  }
  if (hourEmpty || minuteEmpty) {
    const message = "برای واردکردن ساعت، ساعت و دقیقه را هر دو مشخص کن.";
    taskTimeHour.setCustomValidity(message);
    taskTimeMinute.setCustomValidity(message);
    taskTime.value = "";
    return;
  }

  const hour = Number(taskTimeHour.value);
  const minute = Number(taskTimeMinute.value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    taskTimeHour.setCustomValidity("ساعت باید بین ۰ تا ۲۳ باشد.");
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    taskTimeMinute.setCustomValidity("دقیقه باید بین ۰ تا ۵۹ باشد.");
  }

  taskTime.value =
    taskTimeHour.validationMessage || taskTimeMinute.validationMessage
      ? ""
      : `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function setTaskTimeParts(value) {
  const [hour = "", minute = ""] = (value || "").split(":");
  taskTimeHour.value = hour === "" ? "" : String(Number(hour));
  taskTimeMinute.value = minute === "" ? "" : String(Number(minute));
  updateTaskTimeValue();
}

taskTimeHour.addEventListener("input", updateTaskTimeValue);
taskTimeMinute.addEventListener("input", updateTaskTimeValue);
taskTimeHour.addEventListener("change", updateTaskTimeValue);
taskTimeMinute.addEventListener("change", updateTaskTimeValue);
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
const storageWarning = document.querySelector("#storage-warning");

const calendarGrid = document.querySelector("#calendar-grid");
const calendarMonthTitle = document.querySelector("#calendar-month-title");
const selectedDateLabel = document.querySelector("#selected-date-label");
const taskDateLabel = document.querySelector("#task-date-label");
const showAllTasksButton = document.querySelector("#show-all-tasks");

const priorityLabels = { high: "زیاد", medium: "متوسط", low: "کم" };
const categoryLabels = {
  personal: "شخصی", study: "درس و مطالعه", university: "دانشگاه",
  work: "کار", worship: "عبادت", other: "سایر"
};

const jalaliNumericFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric", month: "numeric", day: "numeric"
});
const jalaliMonthFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  month: "long", year: "numeric"
});
const jalaliDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  day: "numeric", month: "long", year: "numeric"
});
const persianNumber = new Intl.NumberFormat("fa-IR");

let storageReady = true;
let tasks = [];

function lockStorage(error) {
  storageReady = false;
  storageWarning.hidden = false;
  storageWarning.textContent =
    `ویرا نتوانست اطلاعات قبلی را با اطمینان بخواند یا ذخیره کند. برای جلوگیری از ازدست‌رفتن اطلاعات، افزودن و ویرایش وظایف موقتاً غیرفعال شده است. جزئیات: ${error.message}`;
  taskForm.querySelectorAll("input, select, button").forEach((control) => {
    control.disabled = true;
  });
}

function persistTasks() {
  try {
    saveTasks(tasks);
    return true;
  } catch (error) {
    try {
      tasks = loadTasks();
    } catch (readError) {
      error = readError;
    }
    lockStorage(error);
    renderTasks();
    renderCalendar();
    storageWarning.textContent =
      `ذخیره‌سازی انجام نشد؛ تغییر اخیر ثبت نشده است و امکانات ویرایش تا بررسی حافظه غیرفعال شدند. ${error.message}`;
    return false;
  }
}

try {
  tasks = loadTasks();
} catch (error) {
  lockStorage(error);
}
let editingTaskId = null;
let selectedDate = null;
let calendarYear;
let calendarMonth;

function toPersianDigits(value) {
  return persianNumber.format(value);
}

function dateToISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoToDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getJalaliParts(date) {
  const parts = jalaliNumericFormatter.formatToParts(date);
  const values = {};
  for (const part of parts) {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      values[part.type] = Number(part.value);
    }
  }
  return values;
}

function findJalaliMonthStart(year, month) {
  // حدود میلادی ماه شمسی را پیدا می‌کنیم و روز اول آن را با تقویم داخلی مرورگر تشخیص می‌دهیم.
  const approximate = new Date(year + 621, month + 1, 15);
  for (let offset = -45; offset <= 45; offset++) {
    const candidate = new Date(approximate);
    candidate.setDate(approximate.getDate() + offset);
    const parts = getJalaliParts(candidate);
    if (parts.year === year && parts.month === month && parts.day === 1) {
      return candidate;
    }
  }
  return null;
}

function formatTaskDate(dateValue) {
  const date = isoToDate(dateValue);
  return date ? jalaliDateFormatter.format(date) : "";
}

function getTodayISO() {
  return dateToISO(new Date());
}

function showToday() {
  document.querySelector("#today-date").textContent =
    new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    }).format(new Date());
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
  taskTimeHour.setCustomValidity("");
  taskTimeMinute.setCustomValidity("");
  taskTime.value = "";
  editingTaskId = null;
  submitTaskButton.textContent = "افزودن کار";
  cancelEditButton.hidden = true;
}

function startEditingTask(task) {
  editingTaskId = task.id;
  taskInput.value = task.title;
  taskDate.value = task.date || "";
  setTaskTimeParts(task.time || "");
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

function getVisibleTasks() {
  return selectedDate
    ? tasks.filter((task) => task.date === selectedDate)
    : tasks;
}

function renderTasks() {
  taskList.replaceChildren();
  const visibleTasks = getVisibleTasks();

  if (visibleTasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = !storageReady
      ? "اطلاعات وظایف در دسترس نیست؛ برای جلوگیری از نمایش اشتباه، فهرست خالی تلقی نمی‌شود."
      : selectedDate
        ? "برای این روز هنوز کاری ثبت نکردی. می‌تونی از فرم بالا یک کار اضافه کنی."
        : "هنوز کاری ثبت نکردی. اولین قدم رو اضافه کن.";
    taskList.append(empty);
    updateProgress();
    return;
  }

  visibleTasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item${task.done ? " completed" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.disabled = !storageReady;
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = Boolean(task.done);
    checkbox.setAttribute("aria-label", "تغییر وضعیت کار");
    checkbox.addEventListener("change", () => {
      try {
        const updatedTask = updateTaskForUI(task, { done: checkbox.checked });
        tasks = tasks.map((entry) => entry.id === task.id ? updatedTask : entry);
        if (persistTasks()) renderTasks();
      } catch (error) {
        lockStorage(error);
        renderTasks();
      }
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
    main.append(meta);

    const editButton = document.createElement("button");
    editButton.disabled = !storageReady;
    editButton.type = "button";
    editButton.className = "edit-task";
    editButton.textContent = "✎";
    editButton.title = "ویرایش کار";
    editButton.setAttribute("aria-label", `ویرایش ${task.title}`);
    editButton.addEventListener("click", () => startEditingTask(task));

    const removeButton = document.createElement("button");
    removeButton.disabled = !storageReady;
    removeButton.type = "button";
    removeButton.className = "delete-task";
    removeButton.textContent = "×";
    removeButton.title = "حذف کار";
    removeButton.setAttribute("aria-label", `حذف ${task.title}`);
    removeButton.addEventListener("click", () => {
      tasks = tasks.filter((entry) => entry.id !== task.id);
      if (editingTaskId === task.id) resetTaskForm();
      persistTasks();
      renderTasks();
      renderCalendar();
    });

    item.append(checkbox, main, editButton, removeButton);
    taskList.append(item);
  });

  updateProgress();
}

function selectCalendarDate(date) {
  selectedDate = dateToISO(date);
  taskDate.value = selectedDate;
  const formatted = jalaliDateFormatter.format(date);
  selectedDateLabel.textContent = `کارهای ${formatted}`;
  taskDateLabel.textContent = formatted;
  renderCalendar();
  renderTasks();
}

function moveSelectedDay(amount) {
  const baseDate = selectedDate ? isoToDate(selectedDate) : new Date();
  baseDate.setDate(baseDate.getDate() + amount);
  const parts = getJalaliParts(baseDate);
  calendarYear = parts.year;
  calendarMonth = parts.month;
  selectCalendarDate(baseDate);
}

function renderCalendar() {
  calendarMonthTitle.textContent = jalaliMonthFormatter.format(
    findJalaliMonthStart(calendarYear, calendarMonth) || new Date()
  );

  while (calendarGrid.children.length > 7) {
    calendarGrid.removeChild(calendarGrid.lastElementChild);
  }

  const firstDay = findJalaliMonthStart(calendarYear, calendarMonth);
  if (!firstDay) return;

  const firstWeekday = (firstDay.getDay() + 1) % 7; // شنبه = صفر
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstWeekday);

  for (let index = 0; index < 42; index++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const parts = getJalaliParts(date);
    const iso = dateToISO(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", jalaliDateFormatter.format(date));
    button.textContent = toPersianDigits(parts.day);

    if (parts.month !== calendarMonth || parts.year !== calendarYear) {
      button.classList.add("outside-month");
    }
    if (iso === getTodayISO()) button.classList.add("is-today");
    if (iso === selectedDate) button.classList.add("is-selected");

    if (tasks.some((task) => task.date === iso)) {
      const dot = document.createElement("span");
      dot.className = "task-dot";
      dot.setAttribute("aria-hidden", "true");
      button.append(dot);
    }

    button.addEventListener("click", () => {
      const clickedParts = getJalaliParts(date);
      calendarYear = clickedParts.year;
      calendarMonth = clickedParts.month;
      selectCalendarDate(date);
    });
    calendarGrid.append(button);
  }
}

function changeCalendarMonth(amount) {
  let nextMonth = calendarMonth + amount;
  let nextYear = calendarYear;
  if (nextMonth < 1) { nextMonth = 12; nextYear--; }
  if (nextMonth > 12) { nextMonth = 1; nextYear++; }
  calendarMonth = nextMonth;
  calendarYear = nextYear;
  renderCalendar();
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!storageReady) return;
  const title = taskInput.value.trim();
  if (!title) return;

  const taskDetails = {
    title,
    date: taskDate.value,
    time: taskTime.value,
    priority: taskPriority.value,
    category: taskCategory.value
  };

  try {
    if (editingTaskId) {
      const task = tasks.find((entry) => entry.id === editingTaskId);
      if (!task) return;
      const updatedTask = updateTaskForUI(task, taskDetails);
      tasks = tasks.map((entry) => entry.id === editingTaskId ? updatedTask : entry);
    } else {
      tasks.unshift(createTaskForUI(taskDetails));
    }
  } catch (error) {
    storageWarning.hidden = false;
    storageWarning.textContent = `اطلاعات واردشده معتبر نیست: ${error.message}`;
    return;
  }

  if (!persistTasks()) return;
  renderTasks();
  renderCalendar();
  resetTaskForm();
  taskInput.focus();
});

cancelEditButton.addEventListener("click", resetTaskForm);
focusButton.addEventListener("click", () => {
  taskInput.focus();
  document.querySelector("#tasks").scrollIntoView({ behavior: "smooth", block: "center" });
});

document.querySelector("#previous-day").addEventListener("click", () => moveSelectedDay(-1));
document.querySelector("#next-day").addEventListener("click", () => moveSelectedDay(1));
document.querySelector("#previous-month").addEventListener("click", () => changeCalendarMonth(-1));
document.querySelector("#next-month").addEventListener("click", () => changeCalendarMonth(1));
document.querySelector("#go-to-today").addEventListener("click", () => {
  const today = new Date();
  const parts = getJalaliParts(today);
  calendarYear = parts.year;
  calendarMonth = parts.month;
  selectCalendarDate(today);
});
showAllTasksButton.addEventListener("click", () => {
  selectedDate = null;
  selectedDateLabel.textContent = "همهٔ کارها نمایش داده می‌شوند";
  taskDateLabel.textContent = "همهٔ کارها";
  renderCalendar();
  renderTasks();
});

const todayParts = getJalaliParts(new Date());
calendarYear = todayParts.year;
calendarMonth = todayParts.month;
showToday();
renderCalendar();
renderTasks();
