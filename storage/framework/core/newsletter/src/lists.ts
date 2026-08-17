import type { CreateListInput } from './types'
import { db } from '@stacksjs/database'

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

/**
 * Data access goes through `db`, not the generated model statics.
 *
 * The statics only exist where the ORM globals have been wired - the
 * framework repo, and an app whose auto-import manifest happens to list the
 * model. An installed app that publishes the marketing models still has to
 * regenerate that manifest before `EmailList.where()` exists, so a package
 * built on the statics fails in the very place it is meant to run.
 * `@stacksjs/cms`, `@stacksjs/forms` and `@stacksjs/sites` all query through
 * `db` for this reason; this package now does too.
 */
export const lists = {
  async create(input: CreateListInput): Promise<EmailListRow> {
    const data = emailListCreateData(input)
    await db.insertInto('email_lists').values(data).execute()

    const row = await lists.find(String(data.slug))
    if (!row)
      throw new Error(`[newsletter] List '${String(data.slug)}' could not be read back after creation`)

    return row
  },

  /** Look up by slug first, then by id — slugs are the public-facing handle. */
  async find(idOrSlug: number | string): Promise<EmailListRow | undefined> {
    const query = db.selectFrom('email_lists').selectAll()
    const row = typeof idOrSlug === 'number'
      ? await query.where('id', '=', idOrSlug).executeTakeFirst()
      : await query.where('slug', '=', idOrSlug).executeTakeFirst()

    return row as EmailListRow | undefined
  },

  async all(): Promise<EmailListRow[]> {
    return await db
      .selectFrom('email_lists')
      .selectAll()
      .where('status', '=', 'active')
      .execute() as EmailListRow[]
  },

  async archive(idOrSlug: number | string): Promise<unknown> {
    const list = await lists.find(idOrSlug)
    if (!list)
      throw new Error(`[newsletter] List '${String(idOrSlug)}' not found`)

    return await db
      .updateTable('email_lists')
      .set({ status: 'archived' })
      .where('id', '=', Number(list.id))
      .execute()
  },
}
