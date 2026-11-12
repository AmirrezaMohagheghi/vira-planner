import test from "node:test";
import assert from "node:assert/strict";
import { createTaskTimeInput } from "../../src/presentation/tasks/task-time-input.js";

function createInput() {
  const listeners = {};
  let customMessage = "";
  return {
    value: "",
    addEventListener(type, callback) {
      listeners[type] = callback;
    },
    setCustomValidity(message) {
      customMessage = message;
    },
    get validationMessage() {
      return customMessage;
    },
    dispatch(type) {
      listeners[type]?.();
    }
  };
}

function setup() {
  const hourInput = createInput();
  const minuteInput = createInput();
  const timeInput = { value: "" };
  const time = createTaskTimeInput({ hourInput, minuteInput, timeInput });
  return { hourInput, minuteInput, timeInput, time };
}

test("keeps the time empty when both parts are empty", () => {
  const { timeInput, time } = setup();
  time.updateValue();
  assert.equal(time.getValue(), "");
  assert.equal(timeInput.value, "");
});

test("requires both hour and minute when only one is entered", () => {
  const { hourInput, minuteInput, time } = setup();
  hourInput.value = "9";
  time.updateValue();
  assert.match(hourInput.validationMessage, /ساعت و دقیقه/);
  assert.match(minuteInput.validationMessage, /ساعت و دقیقه/);
  assert.equal(time.getValue(), "");
});

test("formats a valid time with two digits", () => {
  const { hourInput, minuteInput, time } = setup();
  hourInput.value = "9";
  minuteInput.value = "5";
  time.updateValue();
  assert.equal(time.getValue(), "09:05");
});

test("rejects out-of-range hour and minute values", () => {
  const { hourInput, minuteInput, time } = setup();
  hourInput.value = "24";
  minuteInput.value = "60";
  time.updateValue();
  assert.match(hourInput.validationMessage, /۰ تا ۲۳/);
  assert.match(minuteInput.validationMessage, /۰ تا ۵۹/);
  assert.equal(time.getValue(), "");
});

test("loads an existing time into its separate inputs", () => {
  const { hourInput, minuteInput, time } = setup();
  time.setValue("08:07");
  assert.equal(hourInput.value, "8");
  assert.equal(minuteInput.value, "7");
  assert.equal(time.getValue(), "08:07");
});

test("clears values and validation messages", () => {
  const { hourInput, minuteInput, time } = setup();
  time.setValue("08:07");
  time.clear();
  assert.equal(hourInput.validationMessage, "");
  assert.equal(minuteInput.validationMessage, "");
  assert.equal(time.getValue(), "");
});
