import test from "node:test";
import assert from "node:assert/strict";
import { createTask } from "../../src/domain/tasks/task.js";
import { createProject, archiveProject, trashProject } from "../../src/domain/projects/project.js";
import {
  attachTaskToProject,
  detachTaskFromProject,
  moveTaskToProject
} from "../../src/application/projects/task-project-relationships.js";

const fixedNow = "2026-11-14T12:00:00.000Z";
const actor = { type: "user", id: "user-1" };

function makeTask(overrides = {}) {
  return createTask({
    id: "task-1",
    title: "وظیفهٔ آزمایشی",
    ...overrides
  }, { now: fixedNow });
}

function makeProject(id, status = "active") {
  return createProject({ id, name: id, status }, { now: fixedNow });
}

function options(eventId = "event-1", overrides = {}) {
  return { actor, now: fixedNow, eventId, ...overrides };
}

test("attaches an independent Task to an active Project and emits history", () => {
  const task = makeTask();
  const project = makeProject("project-1");
  const result = attachTaskToProject(task, project, options());

  assert.equal(result.task.projectId, project.id);
  assert.equal(result.task.updatedAt, fixedNow);
  assert.deepEqual(result.event, {
    id: "event-1",
    occurredAt: fixedNow,
    taskId: task.id,
    type: "attached",
    fromProjectId: null,
    toProjectId: project.id,
    actor: { type: "user", id: "user-1" }
  });
  assert.equal(task.projectId, null);
});

test("rejects attaching a Task that already belongs to a Project", () => {
  assert.throws(
    () => attachTaskToProject(makeTask({ projectId: "project-old" }), makeProject("project-new"), options()),
    /already attached/
  );
});

test("rejects attaching to archived or trashed Projects", () => {
  const task = makeTask();
  assert.throws(
    () => attachTaskToProject(task, archiveProject(makeProject("archived")), options()),
    /active Project/
  );
  assert.throws(
    () => attachTaskToProject(task, trashProject(makeProject("trashed")), options()),
    /active Project/
  );
});

test("detaches from a Project and records the previous reference", () => {
  const task = makeTask({ projectId: "project-1" });
  const result = detachTaskFromProject(task, options());

  assert.equal(result.task.projectId, null);
  assert.equal(result.event.type, "detached");
  assert.equal(result.event.fromProjectId, "project-1");
  assert.equal(result.event.toProjectId, null);
});

test("detaching an already independent Task is an idempotent no-op", () => {
  const task = makeTask();
  const result = detachTaskFromProject(task, options());

  assert.equal(result.task, task);
  assert.equal(result.event, null);
});

test("moves a Task between active Projects and records both references", () => {
  const task = makeTask({ projectId: "project-old" });
  const result = moveTaskToProject(task, makeProject("project-new"), options());

  assert.equal(result.task.projectId, "project-new");
  assert.equal(result.event.type, "moved");
  assert.equal(result.event.fromProjectId, "project-old");
  assert.equal(result.event.toProjectId, "project-new");
});

test("moving to the same Project is an idempotent no-op", () => {
  const task = makeTask({ projectId: "project-1" });
  const result = moveTaskToProject(task, makeProject("project-1"), options());

  assert.equal(result.task, task);
  assert.equal(result.event, null);
});

test("rejects moving an unattached Task or moving to an inactive Project", () => {
  assert.throws(
    () => moveTaskToProject(makeTask(), makeProject("project-2"), options()),
    /must be attached/
  );
  assert.throws(
    () => moveTaskToProject(
      makeTask({ projectId: "project-old" }),
      archiveProject(makeProject("project-archived")),
      options()
    ),
    /active Project/
  );
});

test("validates actor and timestamp before changing a relationship", () => {
  const task = makeTask();
  const project = makeProject("project-1");

  assert.throws(
    () => attachTaskToProject(task, project, { now: fixedNow }),
    /actor/
  );
  assert.throws(
    () => attachTaskToProject(task, project, options("event-2", { actor: { type: "system" } })),
    /actor type/
  );
  assert.throws(
    () => attachTaskToProject(task, project, options("event-3", { now: "invalid" })),
    /timestamp/
  );
  assert.equal(task.projectId, null);
});

test("AI actor metadata is preserved without granting any additional authority", () => {
  const result = attachTaskToProject(
    makeTask(),
    makeProject("project-1"),
    options("event-ai", { actor: { type: "ai", id: "planner-agent" } })
  );

  assert.deepEqual(result.event.actor, { type: "ai", id: "planner-agent" });
});

test("relationship metadata and returned events are immutable snapshots", () => {
  const actorInput = { type: "user", id: "user-1" };
  const result = attachTaskToProject(
    makeTask(),
    makeProject("project-1"),
    options("event-frozen", { actor: actorInput })
  );

  actorInput.id = "changed";
  assert.equal(result.event.actor.id, "user-1");
  assert.equal(Object.isFrozen(result.event), true);
  assert.equal(Object.isFrozen(result.event.actor), true);
});
