export function createTaskListView({
  elements,
  getTasks,
  getSelectedDate,
  isStorageReady,
  onToggleTask,
  onEditTask,
  onDeleteTask,
  formatTaskDate,
  formatDigits
}) {
  const {
    taskList,
    totalCount,
    doneCount,
    leftCount,
    progressRing,
    progressPercent,
    progressCaption
  } = elements;

  const priorityLabels = { high: "زیاد", medium: "متوسط", low: "کم" };
  const categoryLabels = {
    personal: "شخصی", study: "درس و مطالعه", university: "دانشگاه",
    work: "کار", worship: "عبادت", other: "سایر"
  };

  function createMetaChip(text, extraClass = "") {
    const chip = document.createElement("span");
    chip.className = `meta-chip ${extraClass}`.trim();
    chip.textContent = text;
    return chip;
  }

  function getVisibleTasks() {
    const selectedDate = getSelectedDate();
    return selectedDate
      ? getTasks().filter((task) => task.date === selectedDate)
      : getTasks();
  }

  function updateProgress() {
    const tasks = getTasks();
    const total = tasks.length;
    const done = tasks.filter((task) => task.done).length;
    const left = total - done;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    totalCount.textContent = formatDigits(total);
    doneCount.textContent = formatDigits(done);
    leftCount.textContent = formatDigits(left);
    progressPercent.textContent = formatDigits(percent) + "٪";
    progressRing.style.background =
      `conic-gradient(var(--accent) ${percent}%, #28354a ${percent}%)`;

    if (total === 0) {
      progressCaption.textContent = "با یک کار کوچک شروع کن.";
    } else if (percent === 100) {
      progressCaption.textContent = "همهٔ کارها انجام شد؛ دمت گرم! 🎉";
    } else {
      progressCaption.textContent = `${formatDigits(left)} کار تا پایان فهرست باقی مانده.`;
    }
  }

  function render() {
    taskList.replaceChildren();
    const visibleTasks = getVisibleTasks();

    if (visibleTasks.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = !isStorageReady()
        ? "اطلاعات وظایف در دسترس نیست؛ برای جلوگیری از نمایش اشتباه، فهرست خالی تلقی نمی‌شود."
        : getSelectedDate()
          ? "برای این روز هنوز کاری ثبت نکردی. می‌تونی از فرم بالا یک کار اضافه کنی."
          : "هنوز کاری ثبت نکردی. اولین قدم رو اضافه کن.";
      taskList.append(empty);
      updateProgress();
      return;
    }

    visibleTasks.forEach((task) => {
      const item = document.createElement("li");
      item.className = `task-item${task.done ? " completed" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.disabled = !isStorageReady();
      checkbox.type = "checkbox";
      checkbox.className = "task-check";
      checkbox.checked = Boolean(task.done);
      checkbox.setAttribute("aria-label", "تغییر وضعیت کار");
      checkbox.addEventListener("change", () => {
        onToggleTask(task, checkbox.checked);
      });

      const main = document.createElement("div");
      main.className = "task-main";
      const label = document.createElement("span");
      label.className = "task-text";
      label.textContent = task.title;
      main.append(label);

      const meta = document.createElement("div");
      meta.className = "task-meta";
      if (task.date) meta.append(createMetaChip(`📅 ${formatTaskDate(task.date)}`));
      if (task.time) meta.append(createMetaChip(`◷ ${task.time}`));
      const priority = task.priority || "medium";
      meta.append(createMetaChip(`اولویت: ${priorityLabels[priority] || "متوسط"}`, `priority-${priority}`));
      const category = task.category || "personal";
      meta.append(createMetaChip(categoryLabels[category] || "شخصی"));
      main.append(meta);

      const editButton = document.createElement("button");
      editButton.disabled = !isStorageReady();
      editButton.type = "button";
      editButton.className = "edit-task";
      editButton.textContent = "✎";
      editButton.title = "ویرایش کار";
      editButton.setAttribute("aria-label", `ویرایش ${task.title}`);
      editButton.addEventListener("click", () => onEditTask(task));

      const removeButton = document.createElement("button");
      removeButton.disabled = !isStorageReady();
      removeButton.type = "button";
      removeButton.className = "delete-task";
      removeButton.textContent = "×";
      removeButton.title = "حذف کار";
      removeButton.setAttribute("aria-label", `حذف ${task.title}`);
      removeButton.addEventListener("click", () => onDeleteTask(task));

      item.append(checkbox, main, editButton, removeButton);
      taskList.append(item);
    });

    updateProgress();
  }

  return { render };
}
