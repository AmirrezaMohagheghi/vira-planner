# ADR-0003: Transaction Adapter POC Scope

- **Status:** Proposed — implementation not yet authorized
- **Date:** 2026-11-15
- **Scope:** A minimal, disposable proof of concept for atomic writes across TaskRepository and ProjectRepository
- **Branch:** `foundation/architecture-v0-5`
- **Related decisions:** ADR-0001 (Unit of Work boundary), ADR-0002 (transaction adapter POC evaluation)

## 1. Purpose

This document narrows the first implementation experiment. It does not select the final application shell, approve a production database, migrate user data, or replace the current LocalStorage-backed repositories.

The POC must prove one claim with a real SQLite database:

> A Project write and a Task write performed through two repository ports inside one Unit of Work either both commit or neither remains persisted.

Mock-only tests are not sufficient to prove this claim.

## 2. Verified current-repository constraints

The current Application persistence contracts define:

- `TaskRepository`: `getById`, `list`, `listByProjectId`, `save`, and `delete`.
- `ProjectRepository`: `getById`, `list`, `listByGroupId`, and `save`.
- `UnitOfWork`: `execute(callback)`.

The current LocalStorage repository implementations are collection-backed adapters. They read and write their respective collections and do not share a database connection or a real cross-repository transaction. They must remain unchanged during this POC.

The current package manifest contains the Node.js test script and does not declare a Rust/Tauri application workspace. The POC must therefore be isolated from the existing application until its toolchain and platform feasibility are explicitly approved.

## 3. Deliberately narrow scenario

Use a disposable SQLite database with the minimum schema required by the test:

- A `projects` table with a stable primary key and only the fields required by the Project domain record.
- A `tasks` table with a stable primary key, the fields required by the Task domain record, and a nullable `project_id` foreign key referencing `projects(id)`.

The exact columns must be derived from the existing domain validators when implementation begins; do not invent a second production domain model for the POC.

### Success case

1. Start one Unit of Work transaction.
2. Create and save Project P1 through the transaction-scoped ProjectRepository.
3. Create and save Task T1 with `projectId = P1.id` through the transaction-scoped TaskRepository.
4. Complete the callback and commit.
5. Open a fresh database connection and verify that both P1 and T1 exist and that T1 references P1.

### Rollback case

1. Start one Unit of Work transaction.
2. Save Project P2 through ProjectRepository.
3. Cause the subsequent TaskRepository save to fail deterministically (for example, inject a test-only failure before its SQL write).
4. Allow the callback to fail and require the adapter to roll back.
5. Open a fresh database connection and verify that P2 does not exist and no partial Task record remains.

The injected failure must occur after the Project write has executed inside the open transaction. A failure before the first write would not prove cross-repository rollback.

### Why this scenario

The existing ProjectRepository has `save` but no `delete` method. Creating a Project and its dependent Task exercises two write-capable repositories without expanding current public repository contracts or introducing HistoryRepository into the first experiment.

## 4. POC architecture boundary

The POC preserves the existing dependency direction:

- **Application:** orchestrates the use case through the UnitOfWork callback and repository interfaces. Business rules remain here/domain-side, not in Rust.
- **Infrastructure (JavaScript):** provides transaction-scoped repository adapters that translate repository method calls into narrow native commands.
- **Native transaction adapter (candidate: Rust/Tauri):** owns the SQLite connection and transaction lifetime. It validates transaction handles, executes allowlisted repository operations, and performs commit/rollback.
- **SQLite:** stores only disposable POC data.

The JavaScript layer must not send arbitrary SQL strings. Native operations must be allowlisted and accept validated structured data. A transaction handle is an opaque correlation token, not an authorization secret; every command must verify that the handle exists, is active, and belongs to the current adapter instance.

All operations for one Unit of Work must use the same underlying SQLite connection and transaction. A pool of independent connections must not be used as a substitute for connection affinity.

## 5. Minimum lifecycle contract

The public Application-facing contract remains the existing `UnitOfWork.execute(callback)` shape unless implementation evidence requires a separately reviewed contract change.

The native adapter must enforce these lifecycle rules:

1. Begin creates one active transaction context.
2. Repository commands are accepted only for that active context.
3. A successful callback is followed by commit.
4. A callback or repository-operation failure triggers rollback.
5. Commit and rollback are terminal; a closed handle cannot be reused.
6. Nested UnitOfWork execution is rejected in POC v1.
7. A failed rollback is surfaced together with the original operation error.
8. A commit error is not reported as success. If the adapter cannot establish the final database outcome, it reports an explicit uncertain outcome and does not automatically replay the operation.
9. Transaction contexts are cleaned up on every terminal path, including errors and adapter shutdown.

The native adapter should expose only the repository operations needed by this POC (Project get/save and Task get/save/list operations as required by the test). It must not grow into a general-purpose SQL execution API.

## 6. Acceptance tests

All persistence assertions must be made by reopening or independently querying the database after the Unit of Work has ended.

| ID | Test | Required result |
|---|---|---|
| POC-01 | Save Project and dependent Task, then commit | Both records persist; Task references Project |
| POC-02 | Save Project, then fail Task save | Neither record from the transaction persists |
| POC-03 | Use a transaction handle after commit | Operation is rejected |
| POC-04 | Use a transaction handle after rollback | Operation is rejected |
| POC-05 | Run two independent transaction contexts | No handle or uncommitted state is shared |
| POC-06 | Fail the callback | Rollback is attempted and the callback error is preserved |
| POC-07 | Fail rollback after callback failure | Both primary and rollback errors remain observable |
| POC-08 | Attempt nested UnitOfWork execution | Rejected deterministically |
| POC-09 | Fail commit | Never reported as successful; outcome is classified accurately |
| POC-10 | Read committed state from a fresh connection | Results match the commit/rollback outcome |

A test-only failure injector may be used to make POC-02 and error-path tests deterministic. It must not become a production bypass or arbitrary SQL facility.

## 7. Platform and tooling sequence

Do not install dependencies or create a Tauri/Rust workspace as part of the documentation change.

After this scope is reviewed:

1. Inspect the available Windows toolchain and document exact versions.
2. Create an isolated POC workspace or branch-level directory, without changing the current application entry point.
3. Prove the adapter and acceptance tests on Windows first.
4. Evaluate Android build/runtime feasibility with the same Application-facing contract.
5. Record platform gaps and results before proposing any production integration.

Android support is a POC evaluation target, not an assumed result. Do not claim cross-platform success until a real emulator or device test passes.

## 8. Out of scope

- HistoryRepository and history writes.
- Task transfer, Project deletion, and ProjectGroup operations.
- Production schema design and migrations.
- Migration from LocalStorage or modification of existing user data.
- Sync, cloud services, AI/network calls, backup/restore, encryption, and key management.
- Selecting Tauri/SQLite as the final production stack.
- Performance optimization beyond identifying blocking or unsafe transaction lifetimes.

## 9. Risks and implementation cautions

- SQLite permits multiple readers but serializes writers; tests must not assume parallel write transactions.
- Keep transactions short. Do not await AI/network calls, user interaction, or long-running work while a database transaction is open.
- Enable and verify SQLite foreign-key enforcement for every connection used by the POC.
- Use parameterized statements in the native adapter.
- Ensure a failed repository operation cannot leave a transaction context active and reusable.
- A successful POC proves only the tested adapter behavior and platform path; it does not complete Vira's overall foundation.

## 10. Exit criteria and next decision

The POC is successful only when POC-01 through POC-10 pass against the real adapter on Windows, platform feasibility for Android is recorded with actual build/runtime evidence, and the existing Application-facing UnitOfWork contract remains intact (or any proposed change is separately reviewed).

After those results, create a new decision record recommending whether to integrate the adapter, revise the design, or reject the candidate. No production migration or replacement of LocalStorage is implied by passing this POC.
