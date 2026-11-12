import { loadTasks, saveTasks } from "./src/infrastructure/storage/local-task-storage.js";
import { createTaskForUI, updateTaskForUI } from "./src/application/tasks/task-use-cases.js";
import {
  isoToDate,
  formatJalaliDate,
  formatTodayDate
} from "./src/domain/calendar/jalali-calendar.js";
import { createCalendarView } from "./src/presentation/calendar/calendar-view.js";
import { createTaskListView } from "./src/presentation/tasks/task-list-view.js";
import { createTaskTimeInput } from "./src/presentation/tasks/task-time-input.js";
import { createTaskFormView } from "./src/presentation/tasks/task-form-view.js";

const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const taskDate = document.querySelector("#task-date");
const taskTime = document.querySelector("#task-time");
const taskTimeHour = document.querySelector("#task-time-hour");
const taskTimeMinute = document.querySelector("#task-time-minute");

const taskTimeInput = createTaskTimeInput({
  hourInput: taskTimeHour,
  minuteInput: taskTimeMinute,
  timeInput: taskTime
});
const taskPriority = document.querySelector("#task-priority");
const taskCategory = document.querySelector("#task-category");
const submitTaskButton = document.querySelector("#submit-task");
const cancelEditButton = document.querySelector("#cancel-edit");
const focusButton = document.querySelector("#focus-button");
const storageWarning = document.querySelector("#storage-warning");

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
    taskListView.render();
    calendarView.render();
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
let calendarView;
let taskListView;

function toPersianDigits(value) {
  return persianNumber.format(value);
}

function formatTaskDate(dateValue) {
  const date = isoToDate(dateValue);
  return date ? formatJalaliDate(date) : "";
}

function showToday() {
  document.querySelector("#today-date").textContent = formatTodayDate();
}

const taskFormView = createTaskFormView({
  form: taskForm,
  titleInput: taskInput,
  dateInput: taskDate,
  priorityInput: taskPriority,
  categoryInput: taskCategory,
  submitButton: submitTaskButton,
  cancelButton: cancelEditButton,
  taskTimeInput
});

function resetTaskForm() {
  editingTaskId = null;
  taskFormView.reset();
}

function startEditingTask(task) {
  editingTaskId = task.id;
  taskFormView.startEditing(task);
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!storageReady) return;
  const taskDetails = taskFormView.getValues();
  if (!taskDetails.title) return;

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
  taskListView.render();
  calendarView.render();
  resetTaskForm();
  taskInput.focus();
});

cancelEditButton.addEventListener("click", resetTaskForm);
focusButton.addEventListener("click", () => {
  taskInput.focus();
  document.querySelector("#tasks").scrollIntoView({ behavior: "smooth", block: "center" });
});

taskListView = createTaskListView({
  elements: {
    taskList: document.querySelector("#task-list"),
    totalCount: document.querySelector("#total-count"),
    doneCount: document.querySelector("#done-count"),
    leftCount: document.querySelector("#left-count"),
    progressRing: document.querySelector("#progress-ring"),
    progressPercent: document.querySelector("#progress-percent"),
    progressCaption: document.querySelector("#progress-caption")
  },
  getTasks: () => tasks,
  getSelectedDate: () => selectedDate,
  isStorageReady: () => storageReady,
  onToggleTask: (task, done) => {
    try {
      const updatedTask = updateTaskForUI(task, { done });
      tasks = tasks.map((entry) => entry.id === task.id ? updatedTask : entry);
      if (persistTasks()) taskListView.render();
    } catch (error) {
      lockStorage(error);
      taskListView.render();
    }
  },
  onEditTask: startEditingTask,
  onDeleteTask: (task) => {
    tasks = tasks.filter((entry) => entry.id !== task.id);
    if (editingTaskId === task.id) resetTaskForm();
    persistTasks();
    taskListView.render();
    calendarView.render();
  },
  formatTaskDate,
  formatDigits: toPersianDigits
});

calendarView = createCalendarView({
  elements: {
    grid: document.querySelector("#calendar-grid"),
    monthTitle: document.querySelector("#calendar-month-title"),
    selectedDateLabel: document.querySelector("#selected-date-label"),
    taskDateLabel: document.querySelector("#task-date-label"),
    taskDateInput: taskDate,
    previousDayButton: document.querySelector("#previous-day"),
    nextDayButton: document.querySelector("#next-day"),
    previousMonthButton: document.querySelector("#previous-month"),
    nextMonthButton: document.querySelector("#next-month"),
    todayButton: document.querySelector("#go-to-today"),
    showAllTasksButton: document.querySelector("#show-all-tasks")
  },
  getTasks: () => tasks,
  getSelectedDate: () => selectedDate,
  onDateSelected: (date) => {
    selectedDate = date;
    taskListView.render();
  },
  onShowAllTasks: () => {
    selectedDate = null;
    taskListView.render();
  },
  formatDigits: toPersianDigits
});

showToday();
calendarView.render();
taskListView.render();
