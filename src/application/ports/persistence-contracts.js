/**
 * Application-level persistence contracts.
 *
 * Implementations are supplied by Infrastructure. Every method that performs
 * I/O must return a Promise. These validators check object shape only; they do
 * not execute methods or claim that an implementation provides real database
 * transactions.
 *
 * @typedef {Object} TaskRepository
 * @property {(id: string) => Promise<Object|null>} getById
 * @property {(query?: Object) => Promise<Object[]>} list
 * @property {(projectId: string) => Promise<Object[]>} listByProjectId
 * @property {(task: Object) => Promise<Object>} save
 *
 * @typedef {Object} ProjectRepository
 * @property {(id: string) => Promise<Object|null>} getById
 * @property {(query?: Object) => Promise<Object[]>} list
 * @property {(groupId: string) => Promise<Object[]>} listByGroupId
 * @property {(project: Object) => Promise<Object>} save
 *
 * @typedef {Object} ProjectGroupRepository
 * @property {(id: string) => Promise<Object|null>} getById
 * @property {(query?: Object) => Promise<Object[]>} list
 * @property {(group: Object) => Promise<Object>} save
 *
 * @typedef {Object} TaskProjectLinkHistoryRepository
 * @property {(event: Object) => Promise<Object|void>} append
 * @property {(taskId: string) => Promise<Object[]>} listByTask
 *
 * @typedef {Object} PersistenceRepositories
 * @property {TaskRepository} tasks
 * @property {ProjectRepository} projects
 * @property {ProjectGroupRepository} projectGroups
 * @property {TaskProjectLinkHistoryRepository} taskProjectHistory
 *
 * @typedef {Object} UnitOfWork
 * @property {(work: (repositories: PersistenceRepositories) => Promise<*>)
 *   => Promise<*>} execute
 */

const REPOSITORY_METHODS = Object.freeze({
  TaskRepository: Object.freeze([
    "getById",
    "list",
    "listByProjectId",
    "save"
  ]),
  ProjectRepository: Object.freeze([
    "getById",
    "list",
    "listByGroupId",
    "save"
  ]),
  ProjectGroupRepository: Object.freeze([
    "getById",
    "list",
    "save"
  ]),
  TaskProjectLinkHistoryRepository: Object.freeze([
    "append",
    "listByTask"
  ])
});

function assertMethods(candidate, methods, contractName) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new TypeError(`${contractName} must be an object.`);
  }

  for (const method of methods) {
    if (typeof candidate[method] !== "function") {
      throw new TypeError(
        `${contractName} requires a ${method}() function.`
      );
    }
  }

  return candidate;
}

/**
 * @param {TaskRepository} repository
 * @returns {TaskRepository}
 */
export function assertTaskRepository(repository) {
  return assertMethods(
    repository,
    REPOSITORY_METHODS.TaskRepository,
    "TaskRepository"
  );
}

/**
 * @param {ProjectRepository} repository
 * @returns {ProjectRepository}
 */
export function assertProjectRepository(repository) {
  return assertMethods(
    repository,
    REPOSITORY_METHODS.ProjectRepository,
    "ProjectRepository"
  );
}

/**
 * @param {ProjectGroupRepository} repository
 * @returns {ProjectGroupRepository}
 */
export function assertProjectGroupRepository(repository) {
  return assertMethods(
    repository,
    REPOSITORY_METHODS.ProjectGroupRepository,
    "ProjectGroupRepository"
  );
}

/**
 * @param {TaskProjectLinkHistoryRepository} repository
 * @returns {TaskProjectLinkHistoryRepository}
 */
export function assertTaskProjectLinkHistoryRepository(repository) {
  return assertMethods(
    repository,
    REPOSITORY_METHODS.TaskProjectLinkHistoryRepository,
    "TaskProjectLinkHistoryRepository"
  );
}

/**
 * Validates the repository bundle passed to a UnitOfWork callback.
 * @param {PersistenceRepositories} repositories
 * @returns {PersistenceRepositories}
 */
export function assertPersistenceRepositories(repositories) {
  if (!repositories || typeof repositories !== "object" ||
      Array.isArray(repositories)) {
    throw new TypeError("Persistence repositories must be an object.");
  }

  assertTaskRepository(repositories.tasks);
  assertProjectRepository(repositories.projects);
  assertProjectGroupRepository(repositories.projectGroups);
  assertTaskProjectLinkHistoryRepository(repositories.taskProjectHistory);

  return repositories;
}

/**
 * Checks the public shape of a UnitOfWork implementation.
 * Transaction atomicity, rollback behavior, callback scoping, and Promise
 * semantics must be verified by adapter-level contract/integration tests.
 * @param {UnitOfWork} unitOfWork
 * @returns {UnitOfWork}
 */
export function assertUnitOfWork(unitOfWork) {
  if (!unitOfWork || typeof unitOfWork !== "object" ||
      Array.isArray(unitOfWork)) {
    throw new TypeError("UnitOfWork must be an object.");
  }
  if (typeof unitOfWork.execute !== "function") {
    throw new TypeError("UnitOfWork requires an execute() function.");
  }
  return unitOfWork;
}
