export function createTaskFormView({
  form, titleInput, dateInput, priorityInput, categoryInput,
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
      category: categoryInput.value
    };
  }

  return { reset, startEditing, getValues };
}
