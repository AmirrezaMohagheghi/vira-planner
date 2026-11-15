import test from "node:test";
import assert from "node:assert/strict";
import { createProject } from "../../src/domain/projects/project.js";
import { createLocalProjectRepository } from "../../src/infrastructure/storage/local-project-repository.js";

const fixedNow = "2026-11-15T10:00:00.000Z";

function project(id, overrides = {}) {
  return createProject({
    id,
    name: `Project ${id}`,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides
  }, { now: fixedNow });
}

function memoryRepository(initial = []) {
  let stored = structuredClone(initial);
  return {
    repository: createLocalProjectRepository({
      loadProjects: () => structuredClone(stored),
      saveProjects: (items) => { stored = structuredClone(items); }
    }),
    readStored: () => structuredClone(stored)
  };
}

test("returns null for a missing project", async () => {
  const { repository } = memoryRepository();
  assert.equal(await repository.getById("missing"), null);
});

test("returns an isolated project copy", async () => {
  const original = project("project-1");
  const { repository } = memoryRepository([original]);
  const result = await repository.getById("project-1");
  result.name = "Changed externally";
  assert.equal((await repository.getById("project-1")).name, original.name);
});

test("lists isolated copies of all projects", async () => {
  const { repository } = memoryRepository([project("p1"), project("p2")]);
  const result = await repository.list();
  assert.deepEqual(result.map((item) => item.id), ["p1", "p2"]);
  result[0].name = "Changed";
  assert.equal((await repository.getById("p1")).name, "Project p1");
});

test("filters projects by supported query fields", async () => {
  const { repository } = memoryRepository([
    project("p1", { groupId: "g1", status: "active" }),
    project("p2", { groupId: "g2", status: "active" }),
    project("p3", { groupId: "g1", status: "archived" })
  ]);
  const result = await repository.list({ groupId: "g1", status: "active" });
  assert.deepEqual(result.map((item) => item.id), ["p1"]);
});

test("rejects unsupported project list filters, even for empty storage", async () => {
  const { repository } = memoryRepository();
  await assert.rejects(repository.list({ unknown: true }), /Unsupported ProjectRepository list filter/);
});

test("lists projects belonging to a group", async () => {
  const { repository } = memoryRepository([
    project("p1", { groupId: "g1" }),
    project("p2", { groupId: "g2" }),
    project("p3")
  ]);
  assert.deepEqual((await repository.listByGroupId("g1")).map((item) => item.id), ["p1"]);
});

test("inserts a project and persists the collection", async () => {
  const existing = project("p1");
  const added = project("p2");
  const { repository, readStored } = memoryRepository([existing]);
  assert.deepEqual(await repository.save(added), added);
  assert.deepEqual(readStored(), [existing, added]);
});

test("updates an existing project without duplicating it", async () => {
  const original = project("p1");
  const updated = { ...original, name: "Updated project", version: 2 };
  const { repository, readStored } = memoryRepository([original]);
  await repository.save(updated);
  assert.equal(readStored().length, 1);
  assert.equal(readStored()[0].name, "Updated project");
});

test("rejects invalid projects without writing", async () => {
  let writes = 0;
  const repository = createLocalProjectRepository({
    loadProjects: () => [],
    saveProjects: () => { writes += 1; }
  });
  await assert.rejects(repository.save({ id: "broken" }), /Project/);
  assert.equal(writes, 0);
});

test("rejects invalid ids and group ids", async () => {
  const { repository } = memoryRepository();
  await assert.rejects(repository.getById(" "), /id must be a non-empty string/);
  await assert.rejects(repository.listByGroupId(" "), /groupId must be a non-empty string/);
});

test("rejects duplicate ids in stored data", async () => {
  const duplicate = project("p1");
  const { repository } = memoryRepository([duplicate, duplicate]);
  await assert.rejects(repository.list(), /Duplicate project id/);
});

test("propagates storage read and write failures", async () => {
  const readFailure = createLocalProjectRepository({
    loadProjects: () => { throw new Error("project read failed"); },
    saveProjects: () => {}
  });
  await assert.rejects(readFailure.list(), /project read failed/);

  const writeFailure = createLocalProjectRepository({
    loadProjects: () => [],
    saveProjects: () => { throw new Error("project write failed"); }
  });
  await assert.rejects(writeFailure.save(project("p1")), /project write failed/);
});

test("requires injected storage functions", () => {
  assert.throws(() => createLocalProjectRepository(), /requires loadProjects and saveProjects/);
});
