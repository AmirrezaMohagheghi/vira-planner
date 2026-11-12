import { createTaskCollection } from "./src/application/tasks/task-collection.js";
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

const taskCollection = createTaskCollection();

function lockStorage(error) {
  storageWarning.hidden = false;
  storageWarning.textContent =
    `ویرا نتوانست اطلاعات قبلی را با اطمینان بخواند یا ذخیره کند. برای جلوگیری از ازدست‌رفتن اطلاعات، افزودن و ویرایش وظایف موقتاً غیرفعال شده است. جزئیات: ${error.message}`;
  taskForm.querySelectorAll("input, select, button").forEach((control) => {
    control.disabled = true;
  });
}

if (!taskCollection.isStorageReady()) {
  lockStorage(taskCollection.getStorageError());
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
  if (!taskCollection.isStorageReady()) return;
  const taskDetails = taskFormView.getValues();
  if (!taskDetails.title) return;

  let result;
  try {
    result = editingTaskId
      ? taskCollection.update(editingTaskId, taskDetails)
      : taskCollection.create(taskDetails);
  } catch (error) {
    storageWarning.hidden = false;
    storageWarning.textContent = `اطلاعات واردشده معتبر نیست: ${error.message}`;
    return;
  }

  if (!result.ok) {
    if (result.error) lockStorage(result.error);
    taskListView.render();
    calendarView.render();
    return;
  }

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
  getTasks: () => taskCollection.getTasks(),
  getSelectedDate: () => selectedDate,
  isStorageReady: () => taskCollection.isStorageReady(),
  onToggleTask: (task, done) => {
    try {
      const result = taskCollection.toggle(task.id, done);
      if (!result.ok && result.error) lockStorage(result.error);
      taskListView.render();
      calendarView.render();
    } catch (error) {
      storageWarning.hidden = false;
      storageWarning.textContent = `تغییر وضعیت وظیفه انجام نشد: ${error.message}`;
    }
  },
  onEditTask: startEditingTask,
  onDeleteTask: (task) => {
    const result = taskCollection.remove(task.id);
    if (editingTaskId === task.id) resetTaskForm();
    if (!result.ok && result.error) lockStorage(result.error);
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
  getTasks: () => taskCollection.getTasks(),
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
