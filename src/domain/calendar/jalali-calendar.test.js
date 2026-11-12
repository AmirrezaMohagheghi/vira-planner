import test from "node:test";
import assert from "node:assert/strict";

import {
  dateToISO,
  isoToDate,
  getJalaliParts,
  formatJalaliDate,
  formatJalaliMonth,
  formatTodayDate,
  getTodayISO,
  getJalaliCalendarDays
} from "./jalali-calendar.js";

test("dateToISO uses local calendar date and zero-padded parts", () => {
  assert.equal(dateToISO(new Date(2024, 2, 20)), "2024-03-20");
});

test("isoToDate parses an ISO date and safely handles an empty value", () => {
  const date = isoToDate("2024-03-20");
  assert.equal(date.getFullYear(), 2024);
  assert.equal(date.getMonth(), 2);
  assert.equal(date.getDate(), 20);
  assert.equal(isoToDate(""), null);
});

test("Jalali date parts identify the first day of 1403", () => {
  assert.deepEqual(getJalaliParts(new Date(2024, 2, 20)), {
    year: 1403,
    month: 1,
    day: 1
  });
});

test("Jalali date and month formatters return Persian labels", () => {
  assert.match(formatJalaliDate(new Date(2024, 2, 20)), /۱/);
  assert.match(formatJalaliMonth(1403, 1), /فروردین/);
  assert.ok(formatTodayDate(new Date(2024, 2, 20)).length > 0);
});

test("getTodayISO accepts a supplied date for deterministic use", () => {
  assert.equal(getTodayISO(new Date(2024, 2, 20)), "2024-03-20");
});

test("calendar returns 42 days and starts its week on Saturday", () => {
  const days = getJalaliCalendarDays(1403, 1);
  assert.equal(days.length, 42);
  assert.equal(days[0].date.getDay(), 6);
  assert.deepEqual(days.find((entry) => entry.parts.month === 1 && entry.parts.day === 1)?.parts, {
    year: 1403,
    month: 1,
    day: 1
  });
});
