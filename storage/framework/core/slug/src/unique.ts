import type { TableNames } from '@stacksjs/types'
import { db } from '@stacksjs/database'
import { slugify } from 'ts-slug'

interface SlugifyOptions {
  table: TableNames
  column: string
}

/**
 * Generate a URL-safe slug that is unique within `options.table.column`.
 *
 * IMPORTANT: this function performs a check-then-write, which means two
 * concurrent callers can both observe "slug is free" and then both insert
 * the same value. Add a UNIQUE constraint on `options.column` in your
 * migration as the source of truth — this helper is for ergonomics, not
 * race protection. A bounded retry budget keeps a runaway loop from
 * hammering the DB if 1000+ records share the same base slug (e.g.
 * "untitled" for unsaved drafts).
 */
export async function uniqueSlug(value: string, options?: SlugifyOptions): Promise<string> {
  const baseSlug = slugify(value)

  if (!options?.table || !options?.column)
    return baseSlug

  let slug = baseSlug
  let counter = 1
  const MAX_ATTEMPTS = 1000

  while (counter <= MAX_ATTEMPTS) {
    const exists = await db
      .selectFrom(options.table)
      .select(['id'])
      .where(options.column, '=', slug)
      .executeTakeFirst()

    if (!exists)
      return slug

    counter++
    slug = `${baseSlug}-${counter}`
  }

  // Fall back to a randomized suffix so the caller still gets *a* unique
  // slug instead of looping forever — collisions past 1000 attempts are
  // almost always pathological (test data fixtures, mass imports).
  return `${baseSlug}-${Math.random().toString(36).slice(2, 10)}`
}

// Re-export the original slugify for convenience
export { slugify }
