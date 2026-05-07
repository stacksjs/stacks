import type { SubscribeOptions, SubscribeResult, UnsubscribeResult } from './types'
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

  const { Subscriber, EmailListSubscriber } = await import('@stacksjs/orm') as any

  const listId = await resolveListId(options.list)
  const source = options.source ?? 'api'

  // Upsert the Subscriber row — `subscribers.email` is unique, so the
  // same address shared across multiple lists points at one row.
  let subscriber = await Subscriber.where('email', email).first()
  if (!subscriber)
    subscriber = await Subscriber.create({ email, status: 'subscribed', source })

  // Pivot row: one per (subscriber, list)
  const existing = await EmailListSubscriber
    .where('subscriber_id', subscriber.id)
    .where('email_list_id', listId)
    .first()

  if (existing) {
    if (existing.status === 'unsubscribed') {
      // Returning subscriber — flip them back. Keep the original token
      // so an old "unsubscribe" link the user kept around still works.
      await existing.update({ status: 'subscribed', unsubscribed_at: null })
    }
    return {
      created: false,
      email,
      listId,
      token: existing.uuid,
    }
  }

  const pivot = await EmailListSubscriber.create({
    subscriber_id: subscriber.id,
    email_list_id: listId,
    status: 'subscribed',
    source,
  })

  return {
    created: true,
    email,
    listId,
    token: pivot.uuid,
  }
}

export async function unsubscribe(token: string): Promise<UnsubscribeResult> {
  if (!token)
    return { ok: false }

  const { EmailListSubscriber, Subscriber } = await import('@stacksjs/orm') as any

  const pivot = await EmailListSubscriber.where('uuid', token).first()
  if (!pivot)
    return { ok: false }

  if (pivot.status === 'unsubscribed') {
    const sub = await Subscriber.find(pivot.subscriber_id)
    return {
      ok: true,
      alreadyUnsubscribed: true,
      email: sub?.email,
      listId: pivot.email_list_id,
    }
  }

  await pivot.update({
    status: 'unsubscribed',
    unsubscribed_at: new Date().toISOString(),
  })

  const sub = await Subscriber.find(pivot.subscriber_id)
  return {
    ok: true,
    email: sub?.email,
    listId: pivot.email_list_id,
  }
}

/** Bulk unsubscribe by email — used by bounce/complaint handlers. */
export async function unsubscribeAll(email: string): Promise<number> {
  const { Subscriber, EmailListSubscriber } = await import('@stacksjs/orm') as any
  const sub = await Subscriber.where('email', email).first()
  if (!sub)
    return 0

  const pivots = await EmailListSubscriber
    .where('subscriber_id', sub.id)
    .where('status', 'subscribed')
    .get()

  for (const pivot of pivots) {
    await pivot.update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
    })
  }
  return pivots.length
}
