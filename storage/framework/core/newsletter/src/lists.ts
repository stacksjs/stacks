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

export const lists = {
  async create(input: CreateListInput) {
    const { EmailList } = await import('@stacksjs/orm') as any
    return EmailList.create(emailListCreateData(input))
  },

  /** Look up by slug first, then by id — slugs are the public-facing handle. */
  async find(idOrSlug: number | string) {
    const { EmailList } = await import('@stacksjs/orm') as any
    if (typeof idOrSlug === 'number')
      return EmailList.find(idOrSlug)
    return EmailList.where('slug', idOrSlug).first()
  },

  async all() {
    const { EmailList } = await import('@stacksjs/orm') as any
    return EmailList.where('status', 'active').get()
  },

  async archive(idOrSlug: number | string) {
    const list = await lists.find(idOrSlug)
    if (!list)
      throw new Error(`[newsletter] List '${String(idOrSlug)}' not found`)
    return list.update({ status: 'archived' })
  },
}
