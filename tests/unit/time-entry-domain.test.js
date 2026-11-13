import test from "node:test";
import assert from "node:assert/strict";
import {
  createTimeEntry,
  findTimeEntryOverlap,
  getExactDurationSeconds,
  summarizeTimeEntries
} from "../../src/domain/work-sessions/time-entry.js";

const now = "2026-11-13T10:00:00.000Z";
const base = {
  workSessionId: "session-1",
  timeZoneId: "Europe/Berlin"
};

test("creates an open timer interval without inventing an end time", () => {
  const entry = createTimeEntry({
    ...base,
    id: "entry-1",
    kind: "timer_interval",
    startedAt: now
  }, { now });

  assert.equal(entry.status, "open");
  assert.equal(entry.endedAt, null);
  assert.equal(getExactDurationSeconds(entry), 0);
});

test("creates a confirmed manual interval and calculates exact duration", () => {
  const entry = createTimeEntry({
    ...base,
    id: "entry-2",
    kind: "manual_interval",
    startedAt: now,
    endedAt: "2026-11-13T11:30:00.000Z"
  }, { now });

  assert.equal(getExactDurationSeconds(entry), 5400);
});

test("creates a manual duration without converting its date to midnight", () => {
  const entry = createTimeEntry({
    ...base,
    id: "entry-3",
    kind: "manual_duration",
    durationSeconds: 5400,
    occurredOn: "2026-11-13"
  }, { now });

  assert.equal(entry.startedAt, null);
  assert.equal(entry.endedAt, null);
  assert.equal(entry.occurredOn, "2026-11-13");
});

test("rejects invalid UTC timestamps", () => {
  assert.throws(
    () => createTimeEntry({
      ...base,
      id: "entry-4",
      kind: "manual_interval",
      startedAt: "2026-11-13T10:00:00+01:00",
      endedAt: "2026-11-13T11:00:00.000Z"
    }, { now }),
    /canonical UTC/
  );
});

test("rejects invalid IANA time zone identifiers", () => {
  assert.throws(
    () => createTimeEntry({
      ...base,
      id: "entry-5",
      kind: "manual_duration",
      timeZoneId: "Not/A_Time_Zone",
      durationSeconds: 60
    }, { now }),
    /valid IANA/
  );
});

test("rejects an end time that is not after its start", () => {
  assert.throws(
    () => createTimeEntry({
      ...base,
      id: "entry-6",
      kind: "manual_interval",
      startedAt: now,
      endedAt: now
    }, { now }),
    /after startedAt/
  );
});

test("does not allow manual duration to carry exact timestamps", () => {
  assert.throws(
    () => createTimeEntry({
      ...base,
      id: "entry-7",
      kind: "manual_duration",
      durationSeconds: 60,
      startedAt: now
    }, { now }),
    /cannot have exact timestamps/
  );
});

test("detects overlap between exact intervals, including an open interval", () => {
  const openEntry = createTimeEntry({
    ...base,
    id: "entry-8",
    kind: "timer_interval",
    startedAt: now
  }, { now });
  const candidate = createTimeEntry({
    ...base,
    id: "entry-9",
    kind: "manual_interval",
    startedAt: "2026-11-13T12:00:00.000Z",
    endedAt: "2026-11-13T12:30:00.000Z"
  }, { now });

  assert.equal(findTimeEntryOverlap(candidate, [openEntry]), openEntry);
});

test("allows adjacent exact intervals without treating them as overlap", () => {
  const first = createTimeEntry({
    ...base,
    id: "entry-10",
    kind: "manual_interval",
    startedAt: now,
    endedAt: "2026-11-13T11:00:00.000Z"
  }, { now });
  const next = createTimeEntry({
    ...base,
    id: "entry-11",
    kind: "manual_interval",
    startedAt: "2026-11-13T11:00:00.000Z",
    endedAt: "2026-11-13T12:00:00.000Z"
  }, { now });

  assert.equal(findTimeEntryOverlap(next, [first]), null);
});

test("keeps manual-duration totals separate from exact interval totals", () => {
  const interval = createTimeEntry({
    ...base,
    id: "entry-12",
    kind: "manual_interval",
    startedAt: now,
    endedAt: "2026-11-13T11:00:00.000Z"
  }, { now });
  const duration = createTimeEntry({
    ...base,
    id: "entry-13",
    kind: "manual_duration",
    durationSeconds: 1800,
    occurredOn: null
  }, { now });

  assert.deepEqual(summarizeTimeEntries([interval, duration]), {
    exactDurationSeconds: 3600,
    manualDurationSeconds: 1800
  });
});
