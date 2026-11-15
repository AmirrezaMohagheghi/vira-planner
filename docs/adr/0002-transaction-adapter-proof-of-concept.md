# ADR-0002: Transaction Adapter Proof of Concept

- **Status:** Evaluation proposal — proof of concept (POC) only
- **Date:** 2026-11-15
- **Scope:** Evaluate a real transaction boundary for Vira's repository contracts on Windows and Android
- **Branch:** `foundation/architecture-v0-5`

## Context

Vira's Application layer has a generic `UnitOfWork.execute(callback)` contract. The current collection-backed repositories are useful for tests and early development, but they do not provide durable, cross-repository atomic transactions. LocalStorage does not provide the transaction semantics required by the approved Unit of Work design.

The target platforms currently in scope are Windows desktop and Android. The core should remain local-first and usable offline. No production database or application shell has been selected.

## Findings from the initial technical comparison

### Tauri SQL plugin

Tauri 2 and its SQL plugin list Windows and Android among supported targets, and SQLite is supported. The plugin's JavaScript API provides database loading, query execution, selection, and closing operations. It does not expose a transaction-scoped JavaScript API that guarantees a sequence of calls runs on the same database connection.

The plugin implementation uses a SQLx connection pool for database operations. Separate frontend calls routed through the pool must not be assumed to share one connection. Therefore, issuing `BEGIN`, repository writes, and `COMMIT` as separate ordinary plugin calls is not an acceptable proof of atomicity.

References:
- Tauri SQL plugin documentation: https://v2.tauri.app/plugin/sql/
- Tauri SQL plugin source: https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/sql
- Tauri plugin development: https://v2.tauri.app/develop/plugins/

### SQLite transaction behavior

SQLite provides serializable transaction isolation. It permits multiple independent operations to be in flight, but only one writer can write at a time; concurrent writes are serialized. WAL mode can allow readers and a writer to make progress concurrently, subject to SQLite's documented snapshot and locking behavior.

Reference: https://www.sqlite.org/isolation.html

### Electron

Electron supports desktop platforms, including Windows, but does not provide the same native Android application target. Choosing Electron for desktop would therefore require a separate mobile shell and increase the number of platform implementations to maintain.

Reference: https://www.electronjs.org/docs/latest/

## Candidate for the POC

Evaluate **Tauri 2 + SQLite + a custom native transaction adapter**.

The candidate should preserve the existing Application-facing contract:

```js
await unitOfWork.execute(async (repositories) => {
  const task = await repositories.tasks.getById(taskId);
  await repositories.tasks.save(updatedTask);
  await repositories.taskProjectHistory.append(event);
});
```

The transaction adapter, implemented in the native layer (initially Rust on Tauri), would own the database transaction and connection for the full callback lifetime. Application code would continue to orchestrate business operations through repository interfaces; it must not move business rules into the native storage adapter.

The implementation must provide a transaction-scoped repository context or equivalent opaque transaction handle. Each independent Unit of Work execution must have isolated transaction state. A process-wide boolean or other global transaction flag is not sufficient. If Android requires a platform-specific plugin extension, that extension must preserve the same Application contract and transaction guarantees.

The standard Tauri SQL plugin may still be evaluated for migrations or simple operations, but it must not be used as the Unit of Work transaction manager unless connection affinity and rollback behavior are explicitly proven.

## POC scope

The POC is limited to validating the transaction adapter and platform feasibility. It must not migrate user data or replace the current storage implementation.

### Required behavioral checks

1. Multiple repositories used inside one `execute` callback participate in the same database transaction.
2. A successful callback commits all changes.
3. A callback failure rolls back all changes.
4. If a later repository operation fails after an earlier repository has written, all changes are rolled back.
5. A commit failure is reported as a failed/uncertain commit outcome; it must not be reported as success or casually described as a confirmed rollback.
6. Two independent Unit of Work calls can be in flight without sharing transaction state or seeing uncommitted writes from one another.
7. A nested Unit of Work call from within an active callback is rejected in v1.
8. Transaction-scoped repositories or handles become unusable after the callback/transaction has ended.
9. Rollback failures preserve both the primary operation error and the rollback error.
10. Integration tests against the real adapter verify persisted state after commit and rollback; mock-only tests are insufficient to establish atomicity.

### Platform checks

- Build and run a minimal Windows desktop smoke test.
- Build and run a minimal Android smoke test on a supported emulator or device.
- Confirm that the native transaction lifecycle and error reporting behave consistently on both targets.

## Security and reliability constraints

- Do not expose unrestricted arbitrary SQL execution to the frontend or presentation layer.
- Expose narrow, validated native commands and keep database access behind Infrastructure repository implementations.
- Do not place AI/network calls, user interaction, or long-running work inside a database transaction.
- Keep Domain independent of SQLite, Tauri, SQLx, filesystem APIs, and platform-specific details.
- Preserve the rule that Application coordinates use cases and Infrastructure implements persistence.
- SQLite write concurrency must be handled explicitly; independent in-flight operations do not imply parallel write execution.

## Explicit non-decisions

This ADR does **not** make a final decision on:
- Tauri as Vira's final desktop/mobile shell;
- SQLite as the final production database;
- database schema, schema version, or migration strategy;
- synchronization or cloud provider;
- encryption-at-rest, key management, or backup/restore design;
- replacing the current LocalStorage prototype.

Those decisions require separate evaluation and approval. No production dependency, database, migration, or application code is authorized by this ADR.

## Exit criteria

The POC can be considered successful only when the required behavioral and platform checks above pass, the transaction lifecycle is documented, and the resulting adapter still satisfies the generic Application Unit of Work contract. A successful POC is evidence for a later architecture decision; it is not itself final platform/database approval and does not mean the overall foundation is complete.
