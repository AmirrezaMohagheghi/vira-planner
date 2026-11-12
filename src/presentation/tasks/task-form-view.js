export function createTaskFormView({
  form, titleInput, dateInput, priorityInput, categoryInput, durationInput,
  submitButton, cancelButton, taskTimeInput
}) {
  function reset() {
    form.reset();
    taskTimeInput.clear();
    submitButton.textContent = "افزودن کار";
    cancelButton.hidden = true;
  }

  function startEditing(task) {
    titleInput.value = task.title;
    dateInput.value = task.date || "";
    taskTimeInput.setValue(task.time || "");
    priorityInput.value = task.priority || "medium";
    categoryInput.value = task.category || "personal";
    durationInput.value = task.durationMinutes ?? "";
    submitButton.textContent = "ذخیرهٔ تغییرات";
    cancelButton.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    titleInput.focus();
  }

  function getValues() {
    return {
      title: titleInput.value.trim(),
      date: dateInput.value,
      time: taskTimeInput.getValue(),
      priority: priorityInput.value,
      category: categoryInput.value,
      durationMinutes: durationInput.value === "" ? null : Number(durationInput.value)
    };
  }

  return { reset, startEditing, getValues };
}
