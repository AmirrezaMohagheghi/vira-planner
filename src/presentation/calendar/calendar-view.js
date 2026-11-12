import {
  dateToISO,
  getJalaliParts,
  formatJalaliDate,
  formatJalaliMonth,
  getTodayISO,
  getJalaliCalendarDays,
  isoToDate
} from "../../domain/calendar/jalali-calendar.js";

export function createCalendarView({
  elements,
  getTasks,
  getSelectedDate,
  onDateSelected,
  onShowAllTasks,
  formatDigits
}) {
  const {
    grid,
    monthTitle,
    selectedDateLabel,
    taskDateLabel,
    taskDateInput,
    previousDayButton,
    nextDayButton,
    previousMonthButton,
    nextMonthButton,
    todayButton,
    showAllTasksButton
  } = elements;

  const todayParts = getJalaliParts(new Date());
  let calendarYear = todayParts.year;
  let calendarMonth = todayParts.month;

  function render() {
    monthTitle.textContent = formatJalaliMonth(calendarYear, calendarMonth);

    while (grid.children.length > 7) {
      grid.removeChild(grid.lastElementChild);
    }

    const calendarDays = getJalaliCalendarDays(calendarYear, calendarMonth);
    for (const { date, parts, iso } of calendarDays) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", formatJalaliDate(date));
      button.textContent = formatDigits(parts.day);

      if (parts.month !== calendarMonth || parts.year !== calendarYear) {
        button.classList.add("outside-month");
      }
      if (iso === getTodayISO()) button.classList.add("is-today");
      if (iso === getSelectedDate()) button.classList.add("is-selected");

      if (getTasks().some((task) => task.date === iso)) {
        const dot = document.createElement("span");
        dot.className = "task-dot";
        dot.setAttribute("aria-hidden", "true");
        button.append(dot);
      }

      button.addEventListener("click", () => {
        const clickedParts = getJalaliParts(date);
        calendarYear = clickedParts.year;
        calendarMonth = clickedParts.month;
        selectDate(date);
      });
      grid.append(button);
    }
  }

  function selectDate(date) {
    const iso = dateToISO(date);
    taskDateInput.value = iso;
    const formatted = formatJalaliDate(date);
    selectedDateLabel.textContent = `کارهای ${formatted}`;
    taskDateLabel.textContent = formatted;
    onDateSelected(iso);
    render();
  }

  function moveSelectedDay(amount) {
    const baseDate = getSelectedDate() ? isoToDate(getSelectedDate()) : new Date();
    baseDate.setDate(baseDate.getDate() + amount);
    const parts = getJalaliParts(baseDate);
    calendarYear = parts.year;
    calendarMonth = parts.month;
    selectDate(baseDate);
  }

  function changeMonth(amount) {
    let nextMonth = calendarMonth + amount;
    let nextYear = calendarYear;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear--;
    }
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }
    calendarMonth = nextMonth;
    calendarYear = nextYear;
    render();
  }

  previousDayButton.addEventListener("click", () => moveSelectedDay(-1));
  nextDayButton.addEventListener("click", () => moveSelectedDay(1));
  previousMonthButton.addEventListener("click", () => changeMonth(-1));
  nextMonthButton.addEventListener("click", () => changeMonth(1));
  todayButton.addEventListener("click", () => {
    const today = new Date();
    const parts = getJalaliParts(today);
    calendarYear = parts.year;
    calendarMonth = parts.month;
    selectDate(today);
  });
  showAllTasksButton.addEventListener("click", () => {
    selectedDateLabel.textContent = "همهٔ کارها نمایش داده می‌شوند";
    taskDateLabel.textContent = "همهٔ کارها";
    onShowAllTasks();
    render();
  });

  return { render };
}
