import test from "node:test";
import assert from "node:assert/strict";
import {
  createLocalTaskProjectLinkHistoryRepository
} from "../../src/infrastructure/storage/local-task-project-link-history-repository.js";

const fixedNow = "2026-11-15T10:00:00.000Z";

function event(id, overrides = {}) {
  return {
    id,
    occurredAt: fixedNow,
    taskId: "task-1",
    type: "attached",
    fromProjectId: null,
    toProjectId: "project-1",
    actor: { type: "user", id: "user-1" },
    ...overrides
  };
}

function memoryRepository(initial = []) {
  let stored = structuredClone(initial);
  return {
    repository: createLocalTaskProjectLinkHistoryRepository({
      loadEvents: () => structuredClone(stored),
      saveEvents: (items) => { stored = structuredClone(items); }
    }),
    readStored: () => structuredClone(stored)
  };
}

test("appends and returns an isolated history event", async () => {
  const { repository, readStored } = memoryRepository();
  const input = event("event-1");
  const saved = await repository.append(input);
  saved.actor.id = "changed";
  assert.deepEqual(readStored(), [input]);
  assert.equal((await repository.listByTask("task-1"))[0].actor.id, "user-1");
});

test("lists only events for the requested Task in insertion order", async () => {
  const { repository } = memoryRepository([
    event("event-1"),
    event("event-2", { taskId: "task-2" }),
    event("event-3", {
      type: "moved",
      fromProjectId: "project-1",
      toProjectId: "project-2"
    })
  ]);
  assert.deepEqual(
    (await repository.listByTask("task-1")).map((item) => item.id),
    ["event-1", "event-3"]
  );
});

test("accepts attached, detached, and moved event shapes", async () => {
  const { repository } = memoryRepository();
  await repository.append(event("attached"));
  await repository.append(event("detached", {
    type: "detached",
    fromProjectId: "project-1",
    toProjectId: null
  }));
  await repository.append(event("moved", {
    type: "moved",
    fromProjectId: "project-1",
    toProjectId: "project-2",
    actor: { type: "ai", id: "planner-agent" }
  }));
  assert.equal((await repository.listByTask("task-1")).length, 3);
});

test("rejects invalid event fields and relationship combinations without writing", async () => {
  let writes = 0;
  const { repository } = memoryRepository();
  const invalidEvents = [
    event(" "),
    event("bad-time", { occurredAt: "not-a-date" }),
    event("bad-type", { type: "deleted" }),
    event("bad-attach", { toProjectId: null }),
    event("bad-detach", {
      type: "detached",
      fromProjectId: null,
      toProjectId: null
    }),
    event("bad-move", {
      type: "moved",
      fromProjectId: "project-1",
      toProjectId: "project-1"
    }),
    event("bad-actor", { actor: { type: "system", id: null } })
  ];
  const guarded = createLocalTaskProjectLinkHistoryRepository({
    loadEvents: () => [],
    saveEvents: () => { writes += 1; }
  });
  for (const invalid of invalidEvents) {
    await assert.rejects(guarded.append(invalid));
  }
  assert.equal(writes, 0);
  assert.equal(await repository.listByTask("task-1").then((items) => items.length), 0);
});

test("rejects duplicate event ids in new and stored data", async () => {
  const duplicate = event("event-1");
  const { repository } = memoryRepository([duplicate]);
  await assert.rejects(repository.append(duplicate), /Duplicate history event id/);

  const corrupt = memoryRepository([duplicate, duplicate]).repository;
  await assert.rejects(corrupt.listByTask("task-1"), /Duplicate history event id/);
});

test("rejects invalid Task ids and malformed stored collections", async () => {
  const { repository } = memoryRepository();
  await assert.rejects(repository.listByTask(" "), /taskId must be a non-empty string/);

  const malformed = createLocalTaskProjectLinkHistoryRepository({
    loadEvents: () => ({}),
    saveEvents: () => {}
  });
  await assert.rejects(malformed.listByTask("task-1"), /must return an array/);
});

test("propagates storage read and write failures", async () => {
  const readFailure = createLocalTaskProjectLinkHistoryRepository({
    loadEvents: () => { throw new Error("history read failed"); },
    saveEvents: () => {}
  });
  await assert.rejects(readFailure.listByTask("task-1"), /history read failed/);

  const writeFailure = createLocalTaskProjectLinkHistoryRepository({
    loadEvents: () => [],
    saveEvents: () => { throw new Error("history write failed"); }
  });
  await assert.rejects(writeFailure.append(event("event-1")), /history write failed/);
});

test("requires injected storage functions", () => {
  assert.throws(
    () => createLocalTaskProjectLinkHistoryRepository(),
    /requires loadEvents and saveEvents/
  );
});
