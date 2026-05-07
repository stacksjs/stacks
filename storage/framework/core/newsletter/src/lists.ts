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

export const lists = {
  async create(input: CreateListInput) {
    const { EmailList } = await import('@stacksjs/orm') as any
    const slug = input.slug ?? slugify(input.name)
    return EmailList.create({
      name: input.name,
      slug,
      description: input.description ?? null,
      status: 'active',
      isPublic: input.isPublic === false ? 0 : 1,
      doubleOptIn: input.doubleOptIn === false ? 0 : 1,
      subscriberCount: 0,
      activeCount: 0,
      unsubscribedCount: 0,
      bouncedCount: 0,
    })
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
