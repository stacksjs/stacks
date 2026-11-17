import { timingSafeEqual } from 'node:crypto'
import { db } from '@stacksjs/database/runtime'

/**
 * The order a confirmation link opens, when its `key` is right.
 *
 * A storefront order is opened by a shopper who is often not signed in, from
 * a redirect or an emailed link, so the page and the actions it posts to
 * authorise on possession of the order's unguessable `tracking_token`. Order
 * ids are sequential: without the key, anyone could walk them and read names,
 * emails and addresses, or add to someone else's order.
 */
export async function orderForKey(orderId: unknown, key: unknown): Promise<Record<string, any> | null> {
  const id = Number(orderId)
  const given = String(key ?? '')
  if (!Number.isSafeInteger(id) || id <= 0 || given.length < 16)
    return null
  const order = await (db as any).selectFrom('orders').where('id', '=', id).selectAll().executeTakeFirst()
  if (!order?.tracking_token)
    return null
  return keysMatch(String(order.tracking_token), given) ? order : null
}

/** Compare a stored key with a given one in constant time. */
export function keysMatch(stored: string, given: string): boolean {
  const a = Buffer.from(stored)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}
