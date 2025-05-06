import type { TableNames } from '@stacksjs/types'
import { db } from '@stacksjs/database'
import { slugify } from 'ts-slug'

interface SlugifyOptions {
  table: TableNames
  column: string
}

export async function uniqueSlug(value: string, options?: SlugifyOptions): Promise<string> {
  const baseSlug = slugify(value)

  if (!options?.table || !options?.column)
    return baseSlug

  let slug = baseSlug
  let counter = 1

  while (true) {
    // Using dynamic table query approach
    const exists = await db
      .selectFrom(options.table)
      .select('id')
      .where(options.column, '=', slug)
      .executeTakeFirst()

    if (!exists)
      break

    counter++
    slug = `${baseSlug}-${counter}`
  }

  return slug
}

// Re-export the original slugify for convenience
export { slugify }
