import test from "node:test";
import assert from "node:assert/strict";
import { createProjectGroup } from "../../src/domain/projects/project-group.js";
import { createLocalProjectGroupRepository } from "../../src/infrastructure/storage/local-project-group-repository.js";

const fixedNow = "2026-11-15T10:00:00.000Z";

function group(id, overrides = {}) {
  return createProjectGroup({
    id,
    name: `Group ${id}`,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides
  }, { now: fixedNow });
}

function memoryRepository(initial = []) {
  let stored = structuredClone(initial);
  return {
    repository: createLocalProjectGroupRepository({
      loadProjectGroups: () => structuredClone(stored),
      saveProjectGroups: (items) => { stored = structuredClone(items); }
    }),
    readStored: () => structuredClone(stored)
  };
}

test("returns null for a missing project group", async () => {
  const { repository } = memoryRepository();
  assert.equal(await repository.getById("missing"), null);
});

test("returns an isolated project group copy", async () => {
  const original = group("group-1");
  const { repository } = memoryRepository([original]);
  const result = await repository.getById("group-1");
  result.name = "Changed externally";
  assert.equal((await repository.getById("group-1")).name, original.name);
});

test("lists isolated copies of all project groups", async () => {
  const { repository } = memoryRepository([group("g1"), group("g2")]);
  const result = await repository.list();
  assert.deepEqual(result.map((item) => item.id), ["g1", "g2"]);
  result[0].name = "Changed";
  assert.equal((await repository.getById("g1")).name, "Group g1");
});

test("filters project groups by sort order", async () => {
  const { repository } = memoryRepository([
    group("g1", { sortOrder: 0 }),
    group("g2", { sortOrder: 1 }),
    group("g3", { sortOrder: 0 })
  ]);
  assert.deepEqual((await repository.list({ sortOrder: 0 })).map((item) => item.id), ["g1", "g3"]);
});

test("rejects unsupported list filters, even for empty storage", async () => {
  const { repository } = memoryRepository();
  await assert.rejects(repository.list({ name: "x" }), /Unsupported ProjectGroupRepository list filter/);
});

test("rejects invalid sort order filters", async () => {
  const { repository } = memoryRepository();
  await assert.rejects(repository.list({ sortOrder: -1 }), /sortOrder filter must be a non-negative integer/);
});

test("inserts a project group and persists the collection", async () => {
  const existing = group("g1");
  const added = group("g2");
  const { repository, readStored } = memoryRepository([existing]);
  assert.deepEqual(await repository.save(added), added);
  assert.deepEqual(readStored(), [existing, added]);
});

test("updates an existing group without duplicating it", async () => {
  const original = group("g1");
  const updated = { ...original, name: "Updated group", version: 2 };
  const { repository, readStored } = memoryRepository([original]);
  await repository.save(updated);
  assert.equal(readStored().length, 1);
  assert.equal(readStored()[0].name, "Updated group");
});

test("rejects invalid groups without writing", async () => {
  let writes = 0;
  const repository = createLocalProjectGroupRepository({
    loadProjectGroups: () => [],
    saveProjectGroups: () => { writes += 1; }
  });
  await assert.rejects(repository.save({ id: "broken" }), /ProjectGroup/);
  assert.equal(writes, 0);
});

test("rejects invalid ids", async () => {
  const { repository } = memoryRepository();
  await assert.rejects(repository.getById(" "), /id must be a non-empty string/);
});

test("rejects duplicate ids in stored data", async () => {
  const duplicate = group("g1");
  const { repository } = memoryRepository([duplicate, duplicate]);
  await assert.rejects(repository.list(), /Duplicate project group id/);
});

test("propagates storage read and write failures", async () => {
  const readFailure = createLocalProjectGroupRepository({
    loadProjectGroups: () => { throw new Error("group read failed"); },
    saveProjectGroups: () => {}
  });
  await assert.rejects(readFailure.list(), /group read failed/);

  const writeFailure = createLocalProjectGroupRepository({
    loadProjectGroups: () => [],
    saveProjectGroups: () => { throw new Error("group write failed"); }
  });
  await assert.rejects(writeFailure.save(group("g1")), /group write failed/);
});

test("requires injected storage functions", () => {
  assert.throws(
    () => createLocalProjectGroupRepository(),
    /requires loadProjectGroups and saveProjectGroups/
  );
});
