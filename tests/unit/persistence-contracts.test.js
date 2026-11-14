import test from "node:test";
import assert from "node:assert/strict";
import {
  assertTaskRepository,
  assertProjectRepository,
  assertProjectGroupRepository,
  assertTaskProjectLinkHistoryRepository,
  assertPersistenceRepositories,
  assertUnitOfWork
} from "../../src/application/ports/persistence-contracts.js";

function methods(names) {
  return Object.fromEntries(names.map((name) => [name, () => Promise.resolve()]));
}

function createRepositories() {
  return {
    tasks: methods(["getById", "list", "listByProjectId", "save"]),
    projects: methods(["getById", "list", "listByGroupId", "save"]),
    projectGroups: methods(["getById", "list", "save"]),
    taskProjectHistory: methods(["append", "listByTask"])
  };
}

test("accepts a TaskRepository with the required methods", () => {
  const repository = methods(["getById", "list", "listByProjectId", "save"]);
  assert.equal(assertTaskRepository(repository), repository);
});

test("rejects an incomplete TaskRepository", () => {
  assert.throws(
    () => assertTaskRepository({ getById() {} }),
    /TaskRepository requires a list() function/
  );
});

test("accepts a ProjectRepository with the required methods", () => {
  const repository = methods(["getById", "list", "listByGroupId", "save"]);
  assert.equal(assertProjectRepository(repository), repository);
});

test("rejects a ProjectRepository without listByGroupId", () => {
  assert.throws(
    () => assertProjectRepository(methods(["getById", "list", "save"])),
    /ProjectRepository requires a listByGroupId() function/
  );
});

test("accepts a ProjectGroupRepository with the required methods", () => {
  const repository = methods(["getById", "list", "save"]);
  assert.equal(assertProjectGroupRepository(repository), repository);
});

test("rejects a ProjectGroupRepository without save", () => {
  assert.throws(
    () => assertProjectGroupRepository(methods(["getById", "list"])),
    /ProjectGroupRepository requires a save() function/
  );
});

test("accepts an append-only task-project history repository shape", () => {
  const repository = methods(["append", "listByTask"]);
  assert.equal(assertTaskProjectLinkHistoryRepository(repository), repository);
});

test("rejects a history repository without append", () => {
  assert.throws(
    () => assertTaskProjectLinkHistoryRepository(methods(["listByTask"])),
    /TaskProjectLinkHistoryRepository requires an append() function/
  );
});

test("accepts a complete repository bundle", () => {
  const repositories = createRepositories();
  assert.equal(assertPersistenceRepositories(repositories), repositories);
});

test("rejects a repository bundle with a missing repository", () => {
  const repositories = createRepositories();
  delete repositories.projectGroups;

  assert.throws(
    () => assertPersistenceRepositories(repositories),
    /ProjectGroupRepository must be an object/
  );
});

test("accepts a UnitOfWork with an execute function", () => {
  const unitOfWork = {
    execute: async (work) => work(createRepositories())
  };
  assert.equal(assertUnitOfWork(unitOfWork), unitOfWork);
});

test("rejects a UnitOfWork without execute", () => {
  assert.throws(
    () => assertUnitOfWork({}),
    /UnitOfWork requires an execute() function/
  );
});

test("rejects null and array values instead of treating them as contracts", () => {
  assert.throws(() => assertTaskRepository(null), /must be an object/);
  assert.throws(() => assertUnitOfWork([]), /must be an object/);
});
