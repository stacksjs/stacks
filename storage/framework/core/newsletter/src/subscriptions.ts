import type { SubscribeOptions, SubscribeResult, UnsubscribeResult } from './types'
import { db } from '@stacksjs/database'
import { lists } from './lists'

/**
 * Subscribe / unsubscribe primitives.
 *
 * Subscriptions are stored on the `email_list_subscribers` pivot — that's
 * what makes "same email on multiple lists" work without breaking the
 * unique constraint on `subscribers.email`. Each pivot row carries its
 * own UUID, which doubles as the per-list unsubscribe token so a user
 * unsubscribing from "Weekly Digest" doesn't accidentally drop "Order
 * Confirmations".
 */

async function resolveListId(listRef: string | number | undefined): Promise<number> {
  if (listRef == null) {
    // Default list — auto-create on first use so dev/staging works
    // out of the box without a "go seed a list first" step.
    let list = await lists.find('default')
    if (!list)
      list = await lists.create({ name: 'Default', slug: 'default' })
    return list.id
  }
  const list = await lists.find(listRef)
  if (!list)
    throw new Error(`[newsletter] List '${String(listRef)}' not found`)
  return list.id
}

export async function subscribe(email: string, options: SubscribeOptions = {}): Promise<SubscribeResult> {
  if (!email || !email.includes('@'))
    throw new Error('[newsletter] subscribe() requires a valid email address')

  const listId = await resolveListId(options.list)
  const source = options.source ?? 'api'

  // Upsert the Subscriber row — `subscribers.email` is unique, so the
  // same address shared across multiple lists points at one row.
  let subscriber = await db
    .selectFrom('subscribers')
    .selectAll()
    .where('email', '=', email)
    .executeTakeFirst() as { id: number } | undefined

  if (!subscriber) {
    await db
      .insertInto('subscribers')
      .values({ uuid: crypto.randomUUID(), email, status: 'subscribed', source })
      .execute()

    subscriber = await db
      .selectFrom('subscribers')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst() as { id: number }
  }

  // Pivot row: one per (subscriber, list)
  const existing = await db
    .selectFrom('email_list_subscribers')
    .selectAll()
    .where('subscriber_id', '=', Number(subscriber.id))
    .where('email_list_id', '=', listId)
    .executeTakeFirst() as { id: number, uuid: string, status: string } | undefined

  if (existing) {
    if (existing.status === 'unsubscribed') {
      // Returning subscriber — flip them back. Keep the original token
      // so an old "unsubscribe" link the user kept around still works.
      await db
        .updateTable('email_list_subscribers')
        .set({ status: 'subscribed', unsubscribed_at: null })
        .where('id', '=', Number(existing.id))
        .execute()
    }
    return {
      created: false,
      email,
      listId,
      token: existing.uuid,
    }
  }

  const uuid = crypto.randomUUID()
  await db
    .insertInto('email_list_subscribers')
    .values({
      uuid,
      subscriber_id: Number(subscriber.id),
      email_list_id: listId,
      status: 'subscribed',
      source,
    })
    .execute()

  return {
    created: true,
    email,
    listId,
    token: uuid,
  }
}

export async function unsubscribe(token: string): Promise<UnsubscribeResult> {
  if (!token)
    return { ok: false }

  const pivot = await db
    .selectFrom('email_list_subscribers')
    .selectAll()
    .where('uuid', '=', token)
    .executeTakeFirst() as { id: number, status: string, subscriber_id: number, email_list_id: number } | undefined

  if (!pivot)
    return { ok: false }

  const subscriberEmail = async (): Promise<string | undefined> => {
    const row = await db
      .selectFrom('subscribers')
      .select(['email'])
      .where('id', '=', Number(pivot.subscriber_id))
      .executeTakeFirst() as { email: string } | undefined
    return row?.email
  }

  if (pivot.status === 'unsubscribed') {
    return {
      ok: true,
      alreadyUnsubscribed: true,
      email: await subscriberEmail(),
      listId: pivot.email_list_id,
    }
  }

  await db
    .updateTable('email_list_subscribers')
    .set({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .where('id', '=', Number(pivot.id))
    .execute()

  return {
    ok: true,
    email: await subscriberEmail(),
    listId: pivot.email_list_id,
  }
}

/** Bulk unsubscribe by email — used by bounce/complaint handlers. */
export async function unsubscribeAll(email: string): Promise<number> {
  const sub = await db
    .selectFrom('subscribers')
    .select(['id'])
    .where('email', '=', email)
    .executeTakeFirst() as { id: number } | undefined

  if (!sub)
    return 0

  const pivots = await db
    .selectFrom('email_list_subscribers')
    .select(['id'])
    .where('subscriber_id', '=', Number(sub.id))
    .where('status', '=', 'subscribed')
    .execute() as Array<{ id: number }>

  for (const pivot of pivots) {
    await db
      .updateTable('email_list_subscribers')
      .set({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .where('id', '=', Number(pivot.id))
      .execute()
  }

  return pivots.length
}
