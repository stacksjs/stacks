/**
 * How a catalog is shown: its order (by category, then name, with a
 * garment's sizes small to large), its search, and when stock is low. Pure
 * and dependency-free, so the browser bundles it
 * (`@stacksjs/commerce/catalog`) and a server sorts the same way.
 */

/** Garment sizes, smallest first. */
export const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL'] as const

/**
 * A name's trailing size split off and ranked: `"Logo Tee — M"` is the base
 * `"Logo Tee"` at rank 3. A dash, en dash, em dash or slash may separate it.
 * A name with no size has rank -1.
 */
export function sizeOf(name: string): { base: string, size: string | null, rank: number } {
  const match = /^(.*?)\s*[—–\-/]\s*(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL)$/i.exec(String(name).trim())
  if (!match) return { base: String(name).trim(), size: null, rank: -1 }
  const size = match[2]!.toUpperCase()
  return { base: match[1]!, size, rank: (SIZES as readonly string[]).indexOf(size) }
}

/**
 * Where a category sits in a chosen order. Named ones come in that order, any
 * other after them, and none at all last.
 */
export function categoryRank(category: string | null | undefined, order: readonly string[] = []): number {
  const index = order.indexOf(String(category || ''))
  if (index !== -1) return index
  return category ? order.length : order.length + 1
}

export interface Orderable { name?: string | null, category?: string | null }

/**
 * A comparator for a catalog: by category in `order` (then alphabetically),
 * then by name, with sizes of the same garment small to large.
 *
 * ```ts
 * products.sort(compareCatalog(['Drinks', 'Apparel']))
 * ```
 */
export function compareCatalog(order: readonly string[] = []): (a: Orderable, b: Orderable) => number {
  return (a, b) => {
    const byCategory = categoryRank(a.category, order) - categoryRank(b.category, order)
      || String(a.category || '').localeCompare(String(b.category || ''))
    if (byCategory) return byCategory
    const left = sizeOf(String(a.name || ''))
    const right = sizeOf(String(b.name || ''))
    return left.base.localeCompare(right.base) || left.rank - right.rank
  }
}

/**
 * Whether something matches a search: every word of the query somewhere in
 * the given fields, ignoring case. An empty query matches everything.
 *
 * ```ts
 * matchesSearch([product.name, product.sku, product.category], 'gat lemon')
 * ```
 */
export function matchesSearch(fields: unknown[], query: string): boolean {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const haystack = fields.map(field => String(field ?? '')).join(' ').toLowerCase()
  return words.every(word => haystack.includes(word))
}

/**
 * Whether counted stock is at or under the level to reorder at (`defaultLow`
 * when the product sets none). Uncounted stock is never low.
 */
export function isLowStock(stock: number | null | undefined, reorderAt?: number | null, defaultLow = 5): boolean {
  if (stock === null || stock === undefined) return false
  return Number(stock) <= (reorderAt === null || reorderAt === undefined ? defaultLow : Number(reorderAt))
}
