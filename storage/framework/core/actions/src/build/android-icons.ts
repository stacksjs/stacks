import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

/** Lucide's icons as Iconify keeps them (`@iconify-json/lucide/icons.json`). */
interface IconifyCollection {
  icons?: Record<string, { body?: string }>
  aliases?: Record<string, { parent?: string }>
  width?: number
  height?: number
}

export interface AndroidIconTable {
  viewBox: number
  strokeWidth: number
  /** An SVG body per Iconify name and per SF Symbol (the first Lucide icon mapped to it). */
  icons: Record<string, string>
}

/**
 * The app's icons as vectors for the Android app, which has no SF Symbols:
 * every Lucide icon stx maps to a symbol (`LUCIDE_TO_SF`), by its own name and
 * by the symbol, so an `<Icon>`, a tab and a bar button draw the icon the web
 * shows. Lucide comes from the app's `@iconify-json/lucide`; an app without it
 * gets no table, and Craft draws Android's nearest glyphs instead.
 */
export function androidIconTable(root: string, lucideToSf: Record<string, string>): AndroidIconTable | null {
  let collection: IconifyCollection
  try {
    const file = createRequire(join(root, 'package.json')).resolve('@iconify-json/lucide/icons.json')
    collection = JSON.parse(readFileSync(file, 'utf8')) as IconifyCollection
  }
  catch {
    return null
  }
  const bodyOf = (name: string): string | undefined => {
    const icon = collection.icons?.[name]
    if (icon?.body) return icon.body
    const parent = collection.aliases?.[name]?.parent
    return parent ? collection.icons?.[parent]?.body : undefined
  }
  const icons: Record<string, string> = {}
  for (const [name, symbol] of Object.entries(lucideToSf)) {
    const body = bodyOf(name)
    if (!body) continue
    icons[name] = body
    // The first Lucide icon for a symbol stands for it (a tab names a symbol).
    icons[symbol] ??= body
  }
  return { viewBox: collection.width ?? 24, strokeWidth: 2, icons }
}

/** Writes the table next to the generated project and answers its path, or null. */
export function writeAndroidIconTable(root: string, output: string, lucideToSf: Record<string, string>): string | null {
  const table = androidIconTable(root, lucideToSf)
  if (!table || !Object.keys(table.icons).length) return null
  const file = join(output, 'craft-icons.json')
  writeFileSync(file, `${JSON.stringify(table)}\n`)
  return existsSync(file) ? file : null
}
