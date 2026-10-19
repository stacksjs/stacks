/**
 * Shared pieces of the dashboard's list screens.
 *
 * Seventeen list dashboards each wrote their own `previousPage` and
 * `nextPage` (stacksjs/stacks#2918), in four different styles. Twelve of them
 * mean the same thing - move a page number, keep it between one and the last
 * page - and this is that, once.
 */

/** The shape `state()` returns, narrowed to what paging needs. */
interface PageSignal {
  (): number
  set: (value: number) => void
}

export interface PageControls {
  /** Back one page, never past the first. */
  previousPage: () => void
  /** Forward one page, never past the last. */
  nextPage: () => void
}

/**
 * Previous and next for a page number bounded by a last page.
 *
 * `lastPage` is an accessor rather than a number because every call site
 * derives it, and reading it at click time is what keeps the clamp correct
 * when a filter shrinks the result set under the reader's feet.
 *
 * Clamps rather than guards. The twelve call sites split between
 * `page.set(Math.max(1, page() - 1))` and `if (page() > 1) page.set(page() - 1)`,
 * which do the same thing from a user's point of view; clamping is the one
 * that stays correct if a page number is ever set out of range by something
 * other than these two functions.
 *
 * Not for the dashboards that page server-side. `Jobs/JobHistory` reloads
 * inside its `nextPage`, and a navigation that triggers a fetch is a
 * different thing wearing the same name.
 */
export function pageControls(page: PageSignal, lastPage: () => number): PageControls {
  return {
    previousPage: () => page.set(Math.max(1, page() - 1)),
    nextPage: () => page.set(Math.min(Math.max(1, lastPage()), page() + 1)),
  }
}
