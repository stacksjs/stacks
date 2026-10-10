import type { OrderStatus } from './events'
import { db, enqueueAfterCommit } from '@stacksjs/database/runtime'
import { canTransition, emitForStatus } from './events'

export interface OrderTransitionOptions {
  values?: Record<string, unknown>
  /** Persist fulfilment or revocation using this transaction, before it commits. */
  apply?: (transaction: Parameters<Parameters<typeof db.transaction>[0]>[0], order: Record<string, unknown>) => Promise<void>
}

/** A conditional status change and its delivery share one commit and one event. */
export async function transitionStatus(id: number, from: OrderStatus, to: OrderStatus, options: OrderTransitionOptions = {}): Promise<boolean> {
  if (!canTransition(from, to))
    throw new Error(`Illegal order transition ${from} -> ${to}`)
  if (from === to) return false
  return db.transaction(async (trx) => {
    const changed = await db.updateTable('orders')
      .set({ ...options.values, status: to, updated_at: new Date().toISOString() })
      .where('id', '=', id).where('status', '=', from).returning('id').execute()
    if (!changed.length) return false
    const order = await db.selectFrom('orders').selectAll().where('id', '=', id).executeTakeFirst()
    if (!order) throw new Error(`Order ${id} disappeared during transition`)
    await options.apply?.(trx, order)
    const emit = () => emitForStatus(to, order)
    if (!enqueueAfterCommit(emit)) await emit()
    return true
  })
}
