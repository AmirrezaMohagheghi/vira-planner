const STORAGE_KEY = "vira-planner-tasks-v1";
const BACKUP_KEY = "vira-planner-tasks-backup-v1";

export class TaskStorageError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = "TaskStorageError";
    this.code = code;
  }
}

function getStorage(storage) {
  if (!storage || typeof storage.getItem !== "function" ||
      typeof storage.setItem !== "function") {
    throw new TaskStorageError(
      "STORAGE_UNAVAILABLE",
      "ذخیره‌سازی مرورگر در دسترس نیست."
    );
  }
  return storage;
}

function validateTasks(value) {
  if (!Array.isArray(value)) {
    throw new TaskStorageError(
      "INVALID_DATA",
      "ساختار اطلاعات وظایف معتبر نیست؛ دادهٔ اصلی دست‌نخورده باقی مانده است."
    );
  }

  const valid = value.every((task) =>
    task &&
    typeof task === "object" &&
    !Array.isArray(task) &&
    typeof task.id === "string" &&
    typeof task.title === "string"
  );

  if (!valid) {
    throw new TaskStorageError(
      "INVALID_TASK",
      "یکی از وظایف ساختار معتبری ندارد؛ دادهٔ اصلی دست‌نخورده باقی مانده است."
    );
  }

  return value;
}

export function loadTasks(storage = globalThis.localStorage) {
  const store = getStorage(storage);
  let saved;

  try {
    saved = store.getItem(STORAGE_KEY);
  } catch (cause) {
    throw new TaskStorageError(
      "READ_FAILED",
      "خواندن اطلاعات ویرا از حافظهٔ مرورگر ممکن نشد.",
      cause
    );
  }

  if (saved === null) return [];

  let parsed;
  try {
    parsed = JSON.parse(saved);
  } catch (cause) {
    throw new TaskStorageError(
      "CORRUPT_JSON",
      "اطلاعات ذخیره‌شده قابل‌خواندن نیست. نسخهٔ اصلی حذف یا بازنویسی نشده است.",
      cause
    );
  }

  return validateTasks(parsed);
}

export function saveTasks(tasks, storage = globalThis.localStorage) {
  const store = getStorage(storage);
  validateTasks(tasks);

  let serialized;
  try {
    serialized = JSON.stringify(tasks);
  } catch (cause) {
    throw new TaskStorageError(
      "SERIALIZE_FAILED",
      "تبدیل وظایف به قالب ذخیره‌سازی ممکن نشد.",
      cause
    );
  }

  let previous;
  try {
    previous = store.getItem(STORAGE_KEY);
    // قبل از جایگزینی دادهٔ قبلی، یک نسخهٔ پشتیبان از آن نگه می‌داریم.
    if (previous !== null) store.setItem(BACKUP_KEY, previous);
    store.setItem(STORAGE_KEY, serialized);
  } catch (cause) {
    throw new TaskStorageError(
      "WRITE_FAILED",
      "ذخیره‌سازی انجام نشد. اطلاعات قبلی تا حد امکان حفظ شده‌اند.",
      cause
    );
  }
}

export const taskStorageKeys = Object.freeze({
  current: STORAGE_KEY,
  backup: BACKUP_KEY
});
