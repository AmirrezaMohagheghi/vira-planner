const jalaliNumericFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric", month: "numeric", day: "numeric"
});

const jalaliMonthFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  month: "long", year: "numeric"
});

const jalaliDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  day: "numeric", month: "long", year: "numeric"
});

const jalaliTodayFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  weekday: "long", day: "numeric", month: "long", year: "numeric"
});

export function dateToISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isoToDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getJalaliParts(date) {
  const parts = jalaliNumericFormatter.formatToParts(date);
  const values = {};
  for (const part of parts) {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      values[part.type] = Number(part.value);
    }
  }
  return values;
}

export function findJalaliMonthStart(year, month) {
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

export function formatJalaliDate(date) {
  return jalaliDateFormatter.format(date);
}

export function formatJalaliMonth(year, month) {
  const firstDay = findJalaliMonthStart(year, month);
  return jalaliMonthFormatter.format(firstDay || new Date());
}

export function formatTodayDate(date = new Date()) {
  return jalaliTodayFormatter.format(date);
}

export function getTodayISO(date = new Date()) {
  return dateToISO(date);
}

export function getJalaliCalendarDays(year, month) {
  const firstDay = findJalaliMonthStart(year, month);
  if (!firstDay) return [];

  const firstWeekday = (firstDay.getDay() + 1) % 7; // شنبه = صفر
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return {
      date,
      iso: dateToISO(date),
      parts: getJalaliParts(date)
    };
  });
}
