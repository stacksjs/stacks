import { model } from './models'
import type { CreateListInput } from './types'

/**
 * EmailList CRUD wrapper.
 *
 * The model lives in `defaults/app/Models/EmailList.ts`; here we expose
 * a friendlier surface for application code so callers don't depend on
 * raw ORM idioms (which changes across releases).
 */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function emailListCreateData(input: CreateListInput): Record<string, string | number | null> {
  return {
    name: input.name,
    slug: input.slug ?? slugify(input.name),
    description: input.description ?? null,
    status: 'active',
    is_public: input.isPublic === false ? 0 : 1,
    double_opt_in: input.doubleOptIn === false ? 0 : 1,
    subscriber_count: 0,
    active_count: 0,
    unsubscribed_count: 0,
    bounced_count: 0,
  }
}

/**
 * A list row as callers use it.
 *
 * The ORM models are reached through `await import(...) as any` (they are
 * generated, and importing them eagerly would make this package depend on the
 * app's model graph), so nothing here has a return type to infer FROM - and
 * dtsx wrote `Promise<void>` into the published types. Every consumer of
 * `lists.find()` therefore got a value it could not read: `if (!list)` did not
 * even compile. Naming the shape is enough to fix that, and it is the shape
 * `email_lists` actually has.
 */
export interface EmailListRow {
  id: number
  uuid?: string
  name: string
  slug: string
  description?: string | null
  status?: string
  subscriber_count?: number
  unsubscribed_count?: number
  bounced_count?: number
  update: (data: Record<string, unknown>) => Promise<unknown>
  [key: string]: unknown
}

export const lists = {
  async create(input: CreateListInput): Promise<EmailListRow> {
    const EmailList = await model('EmailList')
    return EmailList.create(emailListCreateData(input))
  },

  /** Look up by slug first, then by id — slugs are the public-facing handle. */
  async find(idOrSlug: number | string): Promise<EmailListRow | undefined> {
    const EmailList = await model('EmailList')
    if (typeof idOrSlug === 'number')
      return EmailList.find(idOrSlug)
    return EmailList.where('slug', idOrSlug).first()
  },

  async all(): Promise<EmailListRow[]> {
    const EmailList = await model('EmailList')
    return EmailList.where('status', 'active').get()
  },

  async archive(idOrSlug: number | string): Promise<unknown> {
    const list = await lists.find(idOrSlug)
    if (!list)
      throw new Error(`[newsletter] List '${String(idOrSlug)}' not found`)
    return list.update({ status: 'archived' })
  },
}
