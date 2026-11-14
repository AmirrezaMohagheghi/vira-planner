import test from "node:test";
import assert from "node:assert/strict";
import {
  createProjectGroup,
  renameProjectGroup,
  reorderProjectGroup,
  validateProjectGroup
} from "../../src/domain/projects/project-group.js";

const fixedNow = "2026-11-14T10:00:00.000Z";

function makeGroup(overrides = {}) {
  return createProjectGroup({
    id: "group-1",
    name: "تحصیل",
    ...overrides
  }, { now: fixedNow });
}

test("creates a ProjectGroup with a default sort order", () => {
  assert.deepEqual(makeGroup(), {
    id: "group-1",
    name: "تحصیل",
    sortOrder: 0,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    version: 1
  });
});

test("rejects invalid ProjectGroup identity, name, order, timestamp, and version", () => {
  assert.throws(() => makeGroup({ id: "" }), /id/);
  assert.throws(() => makeGroup({ name: " " }), /name/);
  assert.throws(() => makeGroup({ sortOrder: -1 }), /sortOrder/);
  assert.throws(() => makeGroup({ sortOrder: 1.5 }), /sortOrder/);
  assert.throws(() => makeGroup({ updatedAt: "invalid" }), /timestamps/);
  assert.throws(() => makeGroup({ version: 0 }), /version/);
});

test("renames a ProjectGroup without mutating the original", () => {
  const group = makeGroup();
  const renamed = renameProjectGroup(group, "  دانشگاه  ", { now: fixedNow });

  assert.equal(renamed.name, "دانشگاه");
  assert.equal(renamed.version, 2);
  assert.equal(group.name, "تحصیل");
  assert.equal(group.version, 1);
});

test("rejects an empty ProjectGroup name", () => {
  assert.throws(() => renameProjectGroup(makeGroup(), "  "), /name/);
});

test("changes the display order without changing identity", () => {
  const group = makeGroup();
  const reordered = reorderProjectGroup(group, 4, { now: fixedNow });

  assert.equal(reordered.id, group.id);
  assert.equal(reordered.sortOrder, 4);
  assert.equal(reordered.version, 2);
});

test("rejects invalid display order", () => {
  assert.throws(() => reorderProjectGroup(makeGroup(), -2), /sortOrder/);
});

test("validates ProjectGroup objects at the domain boundary", () => {
  assert.throws(() => validateProjectGroup([]), /object/);
});
