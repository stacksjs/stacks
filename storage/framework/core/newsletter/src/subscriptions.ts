import type { SubscribeOptions, SubscribeResult, UnsubscribeResult } from './types'
import { db, getDatabaseDialect, sqlDateTime, sqlHelpers } from '@stacksjs/database/runtime'
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

/** An address as one person: trimmed and lowercased, the way it is stored. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * An address a subscription can be stored under, normalized, or null.
 *
 * One `@`, a dot in the domain, no spaces, quotes or angle brackets, at most
 * 254 characters: the shape every mail system accepts. Checking only for an
 * `@` let `<b>@x` onto lists and into every page that prints an address. The
 * public signup endpoint and `subscribe()` share this check.
 */
export function emailAddress(value: unknown): string | null {
  if (typeof value !== 'string')
    return null

  const email = normalizeEmail(value)
  if (email.length > 254)
    return null

  return /^[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[^\s@<>"'(),;:]{2,}$/.test(email) ? email : null
}

/** A named list that does not exist, or that a public caller may not join. */
export class NewsletterListUnavailableError extends Error {
  constructor(list: string | number, reason: 'missing' | 'private') {
    super(reason === 'missing' ? `[newsletter] List '${String(list)}' not found` : `[newsletter] List '${String(list)}' is not public`)
    this.name = 'NewsletterListUnavailableError'
  }
}

/**
 * Every subscriber row for an address, oldest first, whatever case each was
 * stored in.
 *
 * Addresses used to be stored as typed while the sync looked them up
 * lowercased, so `Alice@Example.com` and `alice@example.com` were two people:
 * a sync re-subscribed someone who had opted out under the other spelling,
 * and a bounce for one spelling left the other on the list
 * (stacksjs/stacks#3155). New rows are stored normalized; rows already stored
 * with capitals are matched here, so they still count as the same person.
 * The address is bound, never inlined.
 */
export async function subscriberIdsForEmail(email: string): Promise<number[]> {
  const param = sqlHelpers(getDatabaseDialect()).param(1)
  const rows = await db.unsafe(
    `SELECT id FROM subscribers WHERE lower(email) = ${param} ORDER BY id`,
    [normalizeEmail(email)],
  ) as unknown as Array<{ id: number | string }>
  return rows.map(row => Number(row.id))
}

/** The list rows for any of `subscriberIds` on `listId`. */
async function listMemberships(subscriberIds: number[], listId: number): Promise<Array<{ id: number, uuid: string, status: string }>> {
  const found: Array<{ id: number, uuid: string, status: string }> = []
  for (const subscriberId of subscriberIds) {
    const row = await db
      .selectFrom('email_list_subscribers')
      .selectAll()
      .where('subscriber_id', '=', subscriberId)
      .where('email_list_id', '=', listId)
      .executeTakeFirst() as { id: number, uuid: string, status: string } | undefined
    if (row)
      found.push(row)
  }
  return found
}

/**
 * Where an address stands on a list: unsubscribed when any of its rows there
 * is, subscribed when one is, otherwise null. An opt-out under one spelling
 * stands for the person.
 */
export async function listStatusForEmail(email: string, listId: number): Promise<string | null> {
  const memberships = await listMemberships(await subscriberIdsForEmail(email), listId)
  if (memberships.some(row => row.status === 'unsubscribed'))
    return 'unsubscribed'
  return memberships.find(row => row.status === 'subscribed')?.status ?? memberships[0]?.status ?? null
}

async function resolveListId(listRef: string | number | undefined, publicOnly = false): Promise<number> {
  if (listRef == null || listRef === '') {
    // Default list — auto-create on first use so dev/staging works
    // out of the box without a "go seed a list first" step.
    let list = await lists.find('default')
    if (!list)
      list = await lists.create({ name: 'Default', slug: 'default' })
    return list.id
  }
  const list = await lists.find(listRef)
  if (!list)
    throw new NewsletterListUnavailableError(listRef, 'missing')
  // `is_public` is stored as a number by some dialects and a boolean by others.
  const isPublic = (list as { is_public?: unknown, isPublic?: unknown }).is_public ?? (list as { isPublic?: unknown }).isPublic
  if (publicOnly && !(isPublic === true || isPublic === 1 || isPublic === '1' || isPublic === 'true'))
    throw new NewsletterListUnavailableError(listRef, 'private')
  return list.id
}

/**
 * Sign the person behind `subscriberId` back up globally when they had used
 * the legacy unsubscribe link, which marks the `subscribers` row itself.
 * Answers whether it did.
 */
async function reactivateSubscriber(subscriberId: number): Promise<boolean> {
  const row = await db
    .selectFrom('subscribers')
    .select(['status'])
    .where('id', '=', subscriberId)
    .executeTakeFirst() as { status?: string } | undefined

  if (row?.status !== 'unsubscribed')
    return false

  await db
    .updateTable('subscribers')
    .set({ status: 'subscribed', unsubscribed_at: null })
    .where('id', '=', subscriberId)
    .execute()
  return true
}

/**
 * Put an address on a list (the default list when none is named).
 *
 * One `subscribers` row per person, one `email_list_subscribers` row per
 * list. A person who had opted out, of this list or globally, is signed back
 * up and `reactivated` says so; they keep their original token, so an old
 * unsubscribe link they kept still works. Calling it again for someone
 * already on the list changes nothing and answers `created: false`.
 */
export async function subscribe(email: string, options: SubscribeOptions = {}): Promise<SubscribeResult> {
  const address = emailAddress(email)
  if (!address)
    throw new Error('[newsletter] subscribe() requires a valid email address')

  email = address
  const listId = await resolveListId(options.list, options.publicOnly)
  const source = (options.source ?? 'api').slice(0, 100)

  // Upsert the Subscriber row — `subscribers.email` is unique, so the
  // same address shared across multiple lists points at one row.
  let subscriberIds = await subscriberIdsForEmail(email)

  if (!subscriberIds.length) {
    await db
      .insertInto('subscribers')
      .values({ uuid: crypto.randomUUID(), email, status: 'subscribed', source })
      .execute()

    subscriberIds = await subscriberIdsForEmail(email)
  }
  const subscriberId = subscriberIds[0]!
  let reactivated = await reactivateSubscriber(subscriberId)

  // Pivot row: one per (subscriber, list)
  const existing = (await listMemberships(subscriberIds, listId))[0]

  if (existing) {
    if (existing.status === 'unsubscribed') {
      // Returning subscriber — flip them back. Keep the original token
      // so an old "unsubscribe" link the user kept around still works.
      await db
        .updateTable('email_list_subscribers')
        .set({ status: 'subscribed', unsubscribed_at: null })
        .where('id', '=', Number(existing.id))
        .execute()
      reactivated = true
    }
    return {
      created: false,
      reactivated,
      email,
      listId,
      subscriberId,
      token: existing.uuid,
    }
  }

  const uuid = crypto.randomUUID()
  await db
    .insertInto('email_list_subscribers')
    .values({
      uuid,
      subscriber_id: subscriberId,
      email_list_id: listId,
      status: 'subscribed',
      source,
    })
    .execute()

  return {
    created: true,
    reactivated,
    email,
    listId,
    subscriberId,
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
    .set({ status: 'unsubscribed', unsubscribed_at: sqlDateTime() })
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
  const pivots: Array<{ id: number }> = []
  for (const subscriberId of await subscriberIdsForEmail(email)) {
    pivots.push(...await db
      .selectFrom('email_list_subscribers')
      .select(['id'])
      .where('subscriber_id', '=', subscriberId)
      .where('status', '=', 'subscribed')
      .execute() as Array<{ id: number }>)
  }

  for (const pivot of pivots) {
    await db
      .updateTable('email_list_subscribers')
      .set({ status: 'unsubscribed', unsubscribed_at: sqlDateTime() })
      .where('id', '=', Number(pivot.id))
      .execute()
  }

  return pivots.length
}
