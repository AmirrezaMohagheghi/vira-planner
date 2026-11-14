import test from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  updateProject,
  archiveProject,
  restoreProject,
  trashProject,
  restoreProjectFromTrash,
  validateProject
} from "../../src/domain/projects/project.js";

const fixedNow = "2026-11-14T10:00:00.000Z";

function makeProject(overrides = {}) {
  return createProject({
    id: "project-1",
    name: "پروژهٔ آزمایشی",
    ...overrides
  }, { now: fixedNow });
}

test("creates an active Project with stable defaults", () => {
  assert.deepEqual(makeProject(), {
    id: "project-1",
    name: "پروژهٔ آزمایشی",
    description: null,
    status: "active",
    createdAt: fixedNow,
    updatedAt: fixedNow,
    version: 1
  });
});

test("trims the Project name and accepts an optional description", () => {
  const project = makeProject({ name: "  پروژه  ", description: "توضیح" });
  assert.equal(project.name, "پروژه");
  assert.equal(project.description, "توضیح");
});

test("rejects invalid Project identity, name, status, timestamps, and version", () => {
  assert.throws(() => makeProject({ id: " " }), /id/);
  assert.throws(() => makeProject({ name: "  " }), /name/);
  assert.throws(() => makeProject({ status: "deleted" }), /status/);
  assert.throws(() => makeProject({ createdAt: "not-a-date" }), /timestamps/);
  assert.throws(() => makeProject({ version: 0 }), /version/);
});

test("updates only editable Project fields and increments its version", () => {
  const project = makeProject();
  const updated = updateProject(project, {
    name: "  نام تازه  ",
    description: "شرح تازه",
    status: "trashed",
    id: "changed"
  }, { now: "2026-11-14T11:00:00.000Z" });

  assert.equal(updated.name, "نام تازه");
  assert.equal(updated.description, "شرح تازه");
  assert.equal(updated.status, "active");
  assert.equal(updated.id, "project-1");
  assert.equal(updated.version, 2);
  assert.equal(updated.updatedAt, "2026-11-14T11:00:00.000Z");
});

test("supports the active to archived to active lifecycle", () => {
  const archived = archiveProject(makeProject(), { now: fixedNow });
  assert.equal(archived.status, "archived");
  assert.equal(restoreProject(archived, { now: fixedNow }).status, "active");
});

test("supports moving an active or archived Project to trash and restoring it", () => {
  const activeTrashed = trashProject(makeProject(), { now: fixedNow });
  assert.equal(activeTrashed.status, "trashed");
  assert.equal(restoreProjectFromTrash(activeTrashed, { now: fixedNow }).status, "active");

  const archivedTrashed = trashProject(
    archiveProject(makeProject(), { now: fixedNow }),
    { now: fixedNow }
  );
  assert.equal(archivedTrashed.status, "trashed");
});

test("rejects invalid lifecycle transitions", () => {
  const active = makeProject();
  assert.throws(() => restoreProject(active), /archived/);
  assert.throws(() => archiveProject(trashProject(active)), /active/);
  assert.throws(() => restoreProjectFromTrash(active), /trash/);
  assert.throws(() => trashProject(trashProject(active)), /already/);
});

test("does not mutate the original Project during updates or transitions", () => {
  const project = makeProject();
  const archived = archiveProject(project, { now: fixedNow });

  assert.equal(project.status, "active");
  assert.equal(project.version, 1);
  assert.equal(archived.status, "archived");
  assert.equal(archived.version, 2);
});

test("validates Project objects at the domain boundary", () => {
  assert.throws(() => validateProject(null), /object/);
});
