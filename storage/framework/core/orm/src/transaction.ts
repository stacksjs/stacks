/**
 * Transaction support using bun-query-builder
 *
 * bun-query-builder provides callback-based transactions that automatically
 * commit on success and rollback on error.
 */

import { db } from '@stacksjs/database'

/**
 * Transaction handle. Aliases the project's `db` type so callers get
 * the same fluent query API inside the callback as outside, without
 * the previous untyped `(tx: any)` signature that erased intellisense
 * and let typo'd column names slip through to runtime.
 */
export type TransactionHandle = typeof db

export interface TransactionOptions {
  /** Number of retry attempts for retriable transaction errors */
  retries?: number
  /** Transaction isolation level */
  isolation?: 'read committed' | 'repeatable read' | 'serializable'
  /** Execute transaction in read-only mode */
  readOnly?: boolean
  /** Called when a transaction is rolled back */
  onRollback?: (error: unknown) => void
  /** Called after rollback completes */
  afterRollback?: () => void
}

/**
 * Execute a callback within a database transaction.
 *
 * The transaction will automatically commit if the callback succeeds,
 * or rollback if an error is thrown.
 *
 * Every query that belongs to the transaction must execute through the `tx`
 * callback handle. The model executor is a separate execution surface and is
 * not rebound to this handle, so `User.find()` or an instance relation call
 * inside the callback cannot be assumed to observe uncommitted `tx` writes.
 *
 * @example
 * ```ts
 * await transaction(async (tx) => {
 *   await tx.insertInto('users').values({ name: 'Alice' }).execute()
 *   await tx.insertInto('profiles').values({ user_id: 1 }).execute()
 * })
 * ```
 */
export async function transaction<T>(
  callback: (tx: TransactionHandle) => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  // The underlying bun-query-builder transaction() typings refer to its
  // internal QueryBuilder<DB> shape, while we expose the augmented `Db`
  // alias here. They're structurally compatible at runtime.
  //
  // The database wrapper owns the dispatch scope and knows when the driver
  // has committed. A second scope here would mistake a post-commit observer
  // failure for a rollback and discard effects for already-committed writes.
  return await (db.transaction as unknown as (cb: (tx: TransactionHandle) => Promise<T>, opts?: TransactionOptions) => Promise<T>)(callback, options)
}

/**
 * Create a savepoint within a transaction for nested rollback support.
 *
 * @example
 * ```ts
 * await transaction(async (tx) => {
 *   await tx.insertInto('users').values({ name: 'Bob' }).execute()
 *
 *   await savepoint(async (sp) => {
 *     await sp.insertInto('logs').values({ action: 'created' }).execute()
 *     // If this fails, only this savepoint rolls back
 *   })
 * })
 * ```
 */
export async function savepoint<T>(callback: (sp: TransactionHandle) => Promise<T>): Promise<T> {
  return await (db.savepoint as unknown as (cb: (sp: TransactionHandle) => Promise<T>) => Promise<T>)(callback)
}

/**
 * Wrap a function to automatically run within a transaction when called.
 *
 * @example
 * ```ts
 * const createUserWithProfile = transactional(async (tx, name: string, bio: string) => {
 *   const user = await tx.insertInto('users').values({ name }).returningAll().executeTakeFirst()
 *   await tx.insertInto('profiles').values({ user_id: user.id, bio }).execute()
 *   return user
 * })
 *
 * // Usage - automatically wrapped in transaction
 * const user = await createUserWithProfile('Alice', 'Hello world')
 * ```
 */
export function transactional<TArgs extends unknown[], R>(
  fn: (tx: TransactionHandle, ...args: TArgs) => Promise<R>,
  options?: TransactionOptions,
): (...args: TArgs) => Promise<R> {
  return (db.transactional as unknown as (
    f: (tx: TransactionHandle, ...args: TArgs) => Promise<R>,
    opts?: TransactionOptions,
  ) => (...args: TArgs) => Promise<R>)(fn, options)
}
