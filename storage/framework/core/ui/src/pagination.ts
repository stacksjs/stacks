/**
 * Pagination view helpers (stacksjs/stacks#1909, P5 from #1910).
 *
 * Pure functions consumed by the `<Pagination>` stx component
 * (`defaults/resources/components/Pagination.stx`). Extracted here so
 * the page-sequence + URL-templating logic is unit-testable independent
 * of the stx render pipeline, and so apps that want to roll their own
 * pagination UI can reuse the same algorithms.
 *
 * The functions operate on the canonical paginator shapes from
 * `@stacksjs/orm` (Paginator / SimplePaginator / CursorPaginator), but
 * accept any duck-typed object with the right fields so callers don't
 * need a runtime import dependency on the orm module just to format
 * page numbers.
 */

/**
 * Subset of {@link Paginator} fields that the view-side helpers actually
 * touch. Keeping this minimal keeps the helper decoupled from the orm.
 */
export interface PaginatorView {
  current_page?: number
  last_page?: number
  prev_page_url?: string | null
  next_page_url?: string | null
  first_page_url?: string
  last_page_url?: string
}

/**
 * Build the page-number sequence for a full paginator, inserting an
 * ellipsis placeholder (`'…'`) for the gap between page 1 / the
 * current-page window / the last page.
 *
 * Examples (window=2):
 *
 *   current=5, last=12  → [1, '…', 3, 4, 5, 6, 7, '…', 12]
 *   current=1, last=3   → [1, 2, 3]                 (window covers all)
 *   current=1, last=1   → []                        (single page → no UI)
 *   current=5, last=5   → [1, 2, 3, 4, 5]           (last is current, no trailing ellipsis)
 *
 * Always anchors the sequence with `1` and `last_page` (when they
 * exist and differ from the current window) so users always have a
 * "jump to start" / "jump to end" affordance.
 *
 * @param current   1-indexed current page
 * @param last      1-indexed last page (`Paginator.last_page`)
 * @param window    Number of neighbors on EACH side of `current` to
 *                  show before the ellipsis kicks in. Default 2 gives
 *                  the canonical compact shape.
 */
export function buildPageSequence(
  current: number,
  last: number,
  window: number = 2,
): Array<number | '…'> {
  if (last <= 1) return []
  const out: Array<number | '…'> = []
  // Window bounds, clamped to [2, last-1] so we don't double-emit 1 or last.
  const lo = Math.max(2, current - window)
  const hi = Math.min(last - 1, current + window)
  out.push(1)
  // Only emit the leading ellipsis when the gap is >1 page wide; a gap of
  // exactly 1 (e.g. lo=3, hiding only page 2) is just shown as the real
  // page number — the ellipsis would be wider on screen than the digit it
  // replaces, and clicking it does nothing.
  if (lo === 3) out.push(2)
  else if (lo > 3) out.push('…')
  for (let i = lo; i <= hi; i++) out.push(i)
  // Symmetric for the trailing side.
  if (hi === last - 2) out.push(last - 1)
  else if (hi < last - 2) out.push('…')
  if (last > 1) out.push(last)
  return out
}

/**
 * Compute the URL for a specific page number, re-templating the
 * `page=N` parameter on whichever existing paginator URL is present.
 * Preserves all other query params (search filters, sort, etc.) — the
 * URLs filled in by `enrichPaginatorUrls()` (P2) already carry them,
 * so the re-template just swaps the page number.
 *
 * Falls back to `?page=N` when no template URL is available — covers
 * the case where the paginator was built outside a request scope (CLI
 * / queue / cron) and rendered via a non-default view; produces a
 * relative link that still works against the active page.
 */
export function urlForPage(view: PaginatorView, page: number): string {
  const template = view.next_page_url || view.prev_page_url || view.first_page_url || view.last_page_url
  if (template) {
    if (/[?&]page=\d+/.test(template))
      return template.replace(/([?&])page=\d+/, `$1page=${page}`)
    // Template has no page= param yet (rare — paginator built without P2
    // enrichment but a URL was attached manually); append it.
    return `${template}${template.includes('?') ? '&' : '?'}page=${page}`
  }
  return `?page=${page}`
}

/**
 * Classify a paginator instance by shape so the view picks the right
 * UI variant. Returns one of `'full'` / `'simple'` / `'cursor'` based
 * on which fields are present. This mirrors `isPaginator` /
 * `isSimplePaginator` / `isCursorPaginator` in `@stacksjs/orm` but
 * lives here so the view layer doesn't need to import the orm.
 */
export function paginatorVariant(p: unknown): 'full' | 'simple' | 'cursor' | 'unknown' {
  if (p === null || typeof p !== 'object') return 'unknown'
  const v = p as Record<string, unknown>
  if ('next_cursor' in v) return 'cursor'
  if ('total' in v && 'last_page' in v) return 'full'
  if ('current_page' in v && 'per_page' in v) return 'simple'
  return 'unknown'
}
