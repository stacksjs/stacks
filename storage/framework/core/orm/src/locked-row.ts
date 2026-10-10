import { lockRow } from '@stacksjs/database/runtime'
import { transaction, type TransactionHandle } from './transaction'

export type RowScope = Record<string, string | number | null>

export interface LockedRowOptions {
  /** Reuse an enclosing transaction; all callback writes must use this handle. */
  tx?: TransactionHandle
}

/** Lock, read and operate on a scoped row on one connection. Missing rows return null. */
export async function withLockedRow<T>(
  table: string,
  scope: RowScope,
  callback: (row: Record<string, unknown>, tx: TransactionHandle) => Promise<T>,
  options: LockedRowOptions = {},
): Promise<T | null> {
  const run = async (tx: TransactionHandle): Promise<T | null> => {
    const row = await lockRow(tx, table, scope)
    return row ? callback(row, tx) : null
  }
  return options.tx ? run(options.tx) : transaction(run)
}
