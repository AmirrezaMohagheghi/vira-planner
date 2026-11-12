import test from "node:test";
import assert from "node:assert/strict";
import { createTaskFormView } from "../../src/presentation/tasks/task-form-view.js";

function element(value = "") {
  return {
    value, textContent: "", hidden: false, focused: false, scrolled: false,
    focus() { this.focused = true; }
  };
}

function setup() {
  const form = { resetCalled: false, scrolled: false, reset() { this.resetCalled = true; }, scrollIntoView() { this.scrolled = true; } };
  const titleInput = element();
  const dateInput = element();
  const priorityInput = element("medium");
  const categoryInput = element("personal");
  const submitButton = element();
  const cancelButton = element();
  const taskTimeInput = { value: "", cleared: false, clear() { this.cleared = true; this.value = ""; }, setValue(value) { this.value = value; }, getValue() { return this.value; } };
  const view = createTaskFormView({ form, titleInput, dateInput, priorityInput, categoryInput, submitButton, cancelButton, taskTimeInput });
  return { view, form, titleInput, dateInput, priorityInput, categoryInput, submitButton, cancelButton, taskTimeInput };
}

test("reads normalized values from the task form", () => {
  const state = setup();
  state.titleInput.value = "  مطالعه  ";
  state.dateInput.value = "2026-11-12";
  state.taskTimeInput.value = "09:05";
  state.priorityInput.value = "high";
  state.categoryInput.value = "study";
  assert.deepEqual(state.view.getValues(), { title: "مطالعه", date: "2026-11-12", time: "09:05", priority: "high", category: "study" });
});

test("resets the form and restores add mode", () => {
  const state = setup();
  state.view.reset();
  assert.equal(state.form.resetCalled, true);
  assert.equal(state.taskTimeInput.cleared, true);
  assert.equal(state.submitButton.textContent, "افزودن کار");
  assert.equal(state.cancelButton.hidden, true);
});

test("loads task values and switches to edit mode", () => {
  const state = setup();
  state.view.startEditing({ title: "مطالعه", date: "2026-11-12", time: "09:05", priority: "high", category: "study" });
  assert.equal(state.titleInput.value, "مطالعه");
  assert.equal(state.dateInput.value, "2026-11-12");
  assert.equal(state.taskTimeInput.value, "09:05");
  assert.equal(state.priorityInput.value, "high");
  assert.equal(state.categoryInput.value, "study");
  assert.equal(state.submitButton.textContent, "ذخیرهٔ تغییرات");
  assert.equal(state.cancelButton.hidden, false);
  assert.equal(state.form.scrolled, true);
  assert.equal(state.titleInput.focused, true);
});

test("uses defaults for optional legacy task fields", () => {
  const state = setup();
  state.view.startEditing({ title: "کار" });
  assert.equal(state.dateInput.value, "");
  assert.equal(state.taskTimeInput.value, "");
  assert.equal(state.priorityInput.value, "medium");
  assert.equal(state.categoryInput.value, "personal");
});
