import test from "node:test";
import assert from "node:assert/strict";
import {
  createCalendarView
} from "../../src/presentation/calendar/calendar-view.js";
import {
  dateToISO,
  formatJalaliDate,
  formatJalaliMonth,
  getJalaliParts,
  getTodayISO
} from "../../src/domain/calendar/jalali-calendar.js";

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.className = "";
    this.classList = {
      values: new Set(),
      add: (...names) => names.forEach((name) => this.classList.values.add(name))
    };
    this.textContent = "";
    this.value = "";
  }

  get lastElementChild() {
    return this.children.at(-1) ?? null;
  }

  append(...elements) {
    this.children.push(...elements);
  }

  removeChild(element) {
    const index = this.children.indexOf(element);
    if (index >= 0) this.children.splice(index, 1);
    return element;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }

  click() {
    this.listeners.click?.();
  }
}

function createFixture(initialSelectedDate = null) {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName)
  };

  const grid = new FakeElement("div");
  for (let index = 0; index < 7; index++) {
    grid.append(new FakeElement("div"));
  }

  const elements = {
    grid,
    monthTitle: new FakeElement(),
    selectedDateLabel: new FakeElement(),
    taskDateLabel: new FakeElement(),
    taskDateInput: new FakeElement("input"),
    previousDayButton: new FakeElement("button"),
    nextDayButton: new FakeElement("button"),
    previousMonthButton: new FakeElement("button"),
    nextMonthButton: new FakeElement("button"),
    todayButton: new FakeElement("button"),
    showAllTasksButton: new FakeElement("button")
  };

  let selectedDate = initialSelectedDate;
  const selectedDates = [];
  let showAllCalls = 0;

  const view = createCalendarView({
    elements,
    getTasks: () => [],
    getSelectedDate: () => selectedDate,
    onDateSelected: (date) => {
      selectedDate = date;
      selectedDates.push(date);
    },
    onShowAllTasks: () => {
      selectedDate = null;
      showAllCalls++;
    },
    formatDigits: (value) => String(value)
  });

  return {
    elements,
    view,
    selectedDates,
    getSelectedDate: () => selectedDate,
    getShowAllCalls: () => showAllCalls,
    restoreDocument: () => {
      if (previousDocument === undefined) {
        delete globalThis.document;
      } else {
        globalThis.document = previousDocument;
      }
    }
  };
}

function fromLocalISO(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addLocalDays(iso, amount) {
  const date = fromLocalISO(iso);
  date.setDate(date.getDate() + amount);
  return dateToISO(date);
}

test("renders 42 calendar days while preserving seven weekday headers", () => {
  const fixture = createFixture();

  try {
    fixture.view.render();

    assert.equal(fixture.elements.grid.children.length, 49);
    assert.equal(
      fixture.elements.grid.children.filter(
        (child) => child.attributes.role === "gridcell"
      ).length,
      42
    );
  } finally {
    fixture.restoreDocument();
  }
});

test("selecting a calendar day updates the input, labels, and selection callback", () => {
  const fixture = createFixture();

  try {
    fixture.view.render();
    const firstDay = fixture.elements.grid.children.find(
      (child) => child.attributes.role === "gridcell"
    );
    const selectedISO = firstDay.attributes["aria-label"];

    firstDay.click();

    assert.equal(fixture.selectedDates.length, 1);
    assert.equal(fixture.getSelectedDate(), fixture.selectedDates[0]);
    assert.equal(
      fixture.elements.taskDateInput.value,
      fixture.selectedDates[0]
    );
    assert.equal(
      fixture.elements.selectedDateLabel.textContent,
      `کارهای ${formatJalaliDate(fromLocalISO(fixture.selectedDates[0]))}`
    );
    assert.equal(
      fixture.elements.taskDateLabel.textContent,
      formatJalaliDate(fromLocalISO(fixture.selectedDates[0]))
    );
    assert.ok(selectedISO);
  } finally {
    fixture.restoreDocument();
  }
});

test("previous-day and next-day controls move from the selected date", () => {
  const fixture = createFixture("2026-03-21");

  try {
    fixture.view.render();
    fixture.elements.previousDayButton.click();
    assert.equal(fixture.getSelectedDate(), addLocalDays("2026-03-21", -1));

    fixture.elements.nextDayButton.click();
    assert.equal(fixture.getSelectedDate(), "2026-03-21");

    fixture.elements.nextDayButton.click();
    assert.equal(fixture.getSelectedDate(), addLocalDays("2026-03-21", 1));
  } finally {
    fixture.restoreDocument();
  }
});

test("previous-month and next-month controls update the displayed Jalali month", () => {
  const fixture = createFixture();

  try {
    const today = getJalaliParts(new Date());
    const nextMonth = today.month === 12 ? 1 : today.month + 1;
    const nextYear = today.month === 12 ? today.year + 1 : today.year;

    fixture.view.render();
    fixture.elements.nextMonthButton.click();
    assert.equal(
      fixture.elements.monthTitle.textContent,
      formatJalaliMonth(nextYear, nextMonth)
    );

    fixture.elements.previousMonthButton.click();
    assert.equal(
      fixture.elements.monthTitle.textContent,
      formatJalaliMonth(today.year, today.month)
    );
  } finally {
    fixture.restoreDocument();
  }
});

test("today control selects today's local date", () => {
  const fixture = createFixture("2026-03-21");

  try {
    fixture.view.render();
    fixture.elements.todayButton.click();

    assert.equal(fixture.getSelectedDate(), getTodayISO());
    assert.equal(fixture.elements.taskDateInput.value, getTodayISO());
  } finally {
    fixture.restoreDocument();
  }
});

test("show-all control clears the selected date and updates its labels", () => {
  const fixture = createFixture("2026-03-21");

  try {
    fixture.view.render();
    fixture.elements.showAllTasksButton.click();

    assert.equal(fixture.getSelectedDate(), null);
    assert.equal(fixture.getShowAllCalls(), 1);
    assert.equal(
      fixture.elements.selectedDateLabel.textContent,
      "همهٔ کارها نمایش داده می‌شوند"
    );
    assert.equal(fixture.elements.taskDateLabel.textContent, "همهٔ کارها");
  } finally {
    fixture.restoreDocument();
  }
});
