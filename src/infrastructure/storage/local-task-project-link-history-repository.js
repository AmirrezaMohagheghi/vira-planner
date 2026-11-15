/**
 * Collection-backed TaskProjectLinkHistoryRepository.
 * Storage is injected; this adapter does not choose a database or provide
 * transaction atomicity with TaskRepository writes.
 */

const EVENT_TYPES = new Set(["attached", "detached", "moved"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function validateEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new TypeError("Task project link history event must be an object.");
  }
  if (!isNonEmptyString(event.id)) {
    throw new TypeError("History event id must be a non-empty string.");
  }
  if (!isNonEmptyString(event.taskId)) {
    throw new TypeError("History event taskId must be a non-empty string.");
  }
  if (typeof event.occurredAt !== "string" ||
      Number.isNaN(Date.parse(event.occurredAt))) {
    throw new TypeError("History event occurredAt must be a valid ISO timestamp.");
  }
  if (!EVENT_TYPES.has(event.type)) {
    throw new TypeError("History event type is invalid.");
  }
  const validProjectReference = (value) =>
    value === null || isNonEmptyString(value);
  if (!validProjectReference(event.fromProjectId) ||
      !validProjectReference(event.toProjectId)) {
    throw new TypeError("History event project references must be non-empty strings or null.");
  }

  if (event.type === "attached" &&
      (event.fromProjectId !== null || event.toProjectId === null)) {
    throw new TypeError("Attached history event must move from null to a Project id.");
  }
  if (event.type === "detached" &&
      (event.fromProjectId === null || event.toProjectId !== null)) {
    throw new TypeError("Detached history event must move from a Project id to null.");
  }
  if (event.type === "moved" &&
      (event.fromProjectId === null || event.toProjectId === null ||
       event.fromProjectId === event.toProjectId)) {
    throw new TypeError("Moved history event must reference two different Project ids.");
  }

  if (!event.actor || typeof event.actor !== "object" ||
      Array.isArray(event.actor) ||
      !["user", "ai"].includes(event.actor.type)) {
    throw new TypeError("History event actor must have type user or ai.");
  }
  if (event.actor.id !== null &&
      event.actor.id !== undefined &&
      !isNonEmptyString(event.actor.id)) {
    throw new TypeError("History event actor id must be a non-empty string or null.");
  }
  return event;
}

export function createLocalTaskProjectLinkHistoryRepository(options = {}) {
  const readEvents = options.loadEvents;
  const writeEvents = options.saveEvents;

  if (typeof readEvents !== "function" || typeof writeEvents !== "function") {
    throw new TypeError(
      "LocalTaskProjectLinkHistoryRepository requires loadEvents and saveEvents functions."
    );
  }

  async function readCollection() {
    const events = await readEvents();
    if (!Array.isArray(events)) {
      throw new TypeError("Task project link history storage must return an array.");
    }

    const ids = new Set();
    for (const event of events) {
      validateEvent(event);
      if (ids.has(event.id)) {
        throw new TypeError(`Duplicate history event id: ${event.id}.`);
      }
      ids.add(event.id);
    }
    return events;
  }

  return Object.freeze({
    async append(event) {
      validateEvent(event);
      const events = await readCollection();
      if (events.some((item) => item.id === event.id)) {
        throw new TypeError(`Duplicate history event id: ${event.id}.`);
      }

      const savedEvent = structuredClone(event);
      await writeEvents([...events, savedEvent]);
      return structuredClone(savedEvent);
    },

    async listByTask(taskId) {
      if (!isNonEmptyString(taskId)) {
        throw new TypeError("History taskId must be a non-empty string.");
      }
      return (await readCollection())
        .filter((event) => event.taskId === taskId)
        .map((event) => structuredClone(event));
    }
  });
}
