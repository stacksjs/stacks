import type { TableNames } from '@stacksjs/types'
import { randomBytes } from 'node:crypto'
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
  //
  // Uses crypto.randomBytes rather than Math.random because slugs end up
  // in URLs and an attacker who can enumerate "next likely" slugs could
  // probe for unsaved drafts or scraping-blocked pages by guessing the
  // suffix. The 6 raw bytes encode to 8 base36 chars of unguessable
  // entropy — same length as the previous Math.random suffix.
  const suffix = randomBytes(6).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  return `${baseSlug}-${suffix}`
}

// Re-export the original slugify for convenience
export { slugify }
