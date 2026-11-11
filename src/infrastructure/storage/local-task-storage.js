const STORAGE_KEY = "vira-planner-tasks-v1";

// فعلاً همان رفتار نسخهٔ قبلی را حفظ می‌کنیم؛
 // مدیریت خطا و بازیابی امن داده را در مرحلهٔ بعد بهتر می‌کنیم.
export function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
