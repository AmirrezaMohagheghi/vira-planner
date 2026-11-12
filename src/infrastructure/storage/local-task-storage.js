import { validateTask } from "../../domain/tasks/task.js";

const STORAGE_KEY = "vira-planner-tasks-v1";
const BACKUP_KEY = "vira-planner-tasks-backup-v1";
const RESTORE_ROLLBACK_KEY = "vira-planner-tasks-pre-restore-v1";
const SCHEMA_VERSION = 2;

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

function validateLegacyTaskRecords(tasks) {
  if (!Array.isArray(tasks)) {
    throw new TaskStorageError("INVALID_DATA", "ساختار اطلاعات قدیمی معتبر نیست.");
  }

  const ids = new Set();
  for (const task of tasks) {
    if (!task || typeof task !== "object" || Array.isArray(task) ||
        typeof task.id !== "string" || task.id.trim() === "" ||
        typeof task.title !== "string" || task.title.trim() === "") {
      throw new TaskStorageError(
        "INVALID_LEGACY_TASK",
        "حداقل یکی از وظایف قدیمی شناسه یا عنوان معتبر ندارد؛ دادهٔ اصلی حفظ شد."
      );
    }
    if (ids.has(task.id)) {
      throw new TaskStorageError(
        "DUPLICATE_TASK_ID",
        `شناسهٔ وظیفهٔ قدیمی تکراری است: ${task.id}.`
      );
    }
    ids.add(task.id);
  }

  return tasks;
}

function validateTaskCollection(tasks) {
  if (!Array.isArray(tasks)) {
    throw new TaskStorageError(
      "INVALID_DATA",
      "ساختار اطلاعات وظایف معتبر نیست؛ دادهٔ اصلی دست‌نخورده باقی مانده است."
    );
  }

  const ids = new Set();
  for (const task of tasks) {
    try {
      validateTask(task);
    } catch (cause) {
      throw new TaskStorageError(
        "INVALID_TASK",
        "حداقل یکی از وظایف با مدل معتبر ویرا سازگار نیست؛ دادهٔ اصلی دست‌نخورده باقی مانده است.",
        cause
      );
    }

    if (ids.has(task.id)) {
      throw new TaskStorageError(
        "DUPLICATE_TASK_ID",
        `شناسهٔ وظیفه تکراری است: ${task.id}. دادهٔ اصلی تغییر نکرد.`
      );
    }
    ids.add(task.id);
  }

  return tasks;
}

function parseSavedValue(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new TaskStorageError(
      "CORRUPT_JSON",
      "اطلاعات ذخیره‌شده قابل‌خواندن نیست. نسخهٔ اصلی حذف یا بازنویسی نشده است.",
      cause
    );
  }

  // Version 1 was a raw array. Application layer owns legacy normalization.
  if (Array.isArray(parsed)) {
    return { kind: "legacy", tasks: validateLegacyTaskRecords(parsed) };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TaskStorageError(
      "INVALID_DATA",
      "ساختار اطلاعات ذخیره‌شده معتبر نیست؛ دادهٔ اصلی دست‌نخورده باقی مانده است."
    );
  }

  if (!Number.isInteger(parsed.schemaVersion) || parsed.schemaVersion < 1) {
    throw new TaskStorageError(
      "INVALID_DATA",
      "ساختار ذخیره‌سازی فاقد شمارهٔ نسخهٔ معتبر است؛ دادهٔ اصلی دست‌نخورده باقی ماند."
    );
  }

  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new TaskStorageError(
      "UNSUPPORTED_SCHEMA_VERSION",
      `نسخهٔ ساختار ذخیره‌سازی پشتیبانی نمی‌شود: ${String(parsed.schemaVersion)}. برای جلوگیری از ازدست‌رفتن اطلاعات، داده بازنویسی نشد.`
    );
  }

  return {
    kind: "current",
    tasks: validateTaskCollection(parsed.tasks)
  };
}

function serializeEnvelope(tasks) {
  validateTaskCollection(tasks);
  try {
    return JSON.stringify({ schemaVersion: SCHEMA_VERSION, tasks });
  } catch (cause) {
    throw new TaskStorageError(
      "SERIALIZE_FAILED",
      "تبدیل وظایف به قالب ذخیره‌سازی ممکن نشد.",
      cause
    );
  }
}

function readRaw(store, key, code = "READ_FAILED") {
  try {
    return store.getItem(key);
  } catch (cause) {
    throw new TaskStorageError(
      code,
      "خواندن اطلاعات از حافظهٔ مرورگر ممکن نشد.",
      cause
    );
  }
}

function writeEnvelope(store, tasks) {
  const serialized = serializeEnvelope(tasks);
  const previous = readRaw(store, STORAGE_KEY);

  try {
    // Preserve the exact previous bytes before replacing the current value.
    if (previous !== null) store.setItem(BACKUP_KEY, previous);
    store.setItem(STORAGE_KEY, serialized);
  } catch (cause) {
    throw new TaskStorageError(
      "WRITE_FAILED",
      "ذخیره‌سازی انجام نشد. نسخهٔ قبلی تا حد امکان حفظ شده است.",
      cause
    );
  }

  let written;
  try {
    written = store.getItem(STORAGE_KEY);
    if (written !== serialized) {
      throw new Error("Stored value differs from the verified value.");
    }
    const parsed = parseSavedValue(written);
    if (parsed.kind !== "current") {
      throw new Error("Stored value is not a current schema envelope.");
    }
  } catch (cause) {
    try {
      if (previous !== null) {
        store.setItem(STORAGE_KEY, previous);
      } else if (typeof store.removeItem === "function") {
        store.removeItem(STORAGE_KEY);
      }
    } catch {
      // The original backup remains available if rollback also fails.
    }
    throw new TaskStorageError(
      "VERIFY_FAILED",
      "بررسی صحت اطلاعات ذخیره‌شده ناموفق بود؛ برنامه نوشتن عادی را متوقف می‌کند.",
      cause
    );
  }
}

export function loadTasks(storage = globalThis.localStorage) {
  const store = getStorage(storage);
  const saved = readRaw(store, STORAGE_KEY);
  if (saved === null) return [];

  return parseSavedValue(saved).tasks;
}

export function saveTasks(tasks, storage = globalThis.localStorage) {
  const store = getStorage(storage);
  writeEnvelope(store, tasks);
}

/**
 * Called by the application after legacy records have been normalized.
 * Migration is performed only for the old raw-array format.
 */
export function migrateLegacyTasks(tasks, storage = globalThis.localStorage) {
  const store = getStorage(storage);
  const saved = readRaw(store, STORAGE_KEY);
  if (saved === null) return false;

  const parsed = parseSavedValue(saved);
  if (parsed.kind !== "legacy") return false;

  writeEnvelope(store, tasks);
  return true;
}

/**
 * Restores the verified backup bytes. The current value is first retained in
 * a separate rollback slot so a failed restore does not destroy either copy.
 */
export function restoreTasksFromBackup(storage = globalThis.localStorage) {
  const store = getStorage(storage);
  const backup = readRaw(store, BACKUP_KEY);
  if (backup === null) {
    throw new TaskStorageError("BACKUP_NOT_FOUND", "نسخهٔ پشتیبانی برای بازیابی وجود ندارد.");
  }

  const parsedBackup = parseSavedValue(backup);
  if (parsedBackup.kind === "current") {
    validateTaskCollection(parsedBackup.tasks);
  }

  const current = readRaw(store, STORAGE_KEY);
  try {
    if (current !== null) store.setItem(RESTORE_ROLLBACK_KEY, current);
    store.setItem(STORAGE_KEY, backup);
    if (store.getItem(STORAGE_KEY) !== backup) {
      throw new Error("Restored value failed byte-for-byte verification.");
    }
  } catch (cause) {
    try {
      if (current !== null) {
        store.setItem(STORAGE_KEY, current);
      } else if (typeof store.removeItem === "function") {
        store.removeItem(STORAGE_KEY);
      }
    } catch {
      // The rollback copy and backup are retained for manual recovery.
    }
    throw new TaskStorageError(
      "RESTORE_FAILED",
      "بازیابی نسخهٔ پشتیبان کامل نشد؛ نسخه‌های موجود برای بررسی حفظ شده‌اند.",
      cause
    );
  }

  return parsedBackup.tasks;
}

export const taskStorageKeys = Object.freeze({
  current: STORAGE_KEY,
  backup: BACKUP_KEY,
  restoreRollback: RESTORE_ROLLBACK_KEY
});
