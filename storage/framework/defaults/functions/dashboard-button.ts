/**
 * The colour classes of a dashboard `<Button>` variant.
 *
 * Shared by the button's server render and its client script. The client half
 * exists for callers that bind `:variant` to client state - the migration
 * plan's confirm button turns `danger` when the plan is destructive - which
 * the server render never sees, so the button kept the variant it was first
 * painted with (stacksjs/stacks#3180).
 */

export const buttonVariantClasses: Record<string, string> & { primary: string } = {
  primary: 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-600/25 hover:from-blue-400 hover:to-blue-500 active:from-blue-600 active:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-500 dark:hover:to-blue-600',
  secondary: 'bg-white/80 dark:bg-white/10 text-neutral-800 dark:text-neutral-100 border border-black/10 dark:border-white/10 shadow-sm hover:bg-white dark:hover:bg-white/15 active:bg-neutral-100 dark:active:bg-white/5',
  outline: 'bg-transparent text-neutral-700 dark:text-neutral-200 border border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/8 active:bg-black/10 dark:active:bg-white/10',
  ghost: 'bg-transparent text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/8 active:bg-black/10 dark:active:bg-white/12',
  danger: 'bg-gradient-to-b from-red-500 to-red-600 text-white shadow-sm shadow-red-600/25 hover:from-red-400 hover:to-red-500 active:from-red-600 active:to-red-700',
  success: 'bg-gradient-to-b from-green-500 to-green-600 text-white shadow-sm shadow-green-600/25 hover:from-green-400 hover:to-green-500 active:from-green-600 active:to-green-700',
  warning: 'bg-gradient-to-b from-orange-500 to-orange-600 text-white shadow-sm shadow-orange-600/25 hover:from-orange-400 hover:to-orange-500 active:from-orange-600 active:to-orange-700',
  /**
   * No chrome at all: the caller supplies every visual through `class`.
   *
   * For an affordance that has to sit inside someone else's layout and carry
   * no box of its own - a sortable table header fills its `<th>`, and the
   * padding and fixed height the sizes impose would change the header row.
   * What it still gets, and the reason to come through this component rather
   * than write a raw `<button>`, is the shared focus-visible ring, the
   * disabled and aria-disabled handling, and the press feedback.
   * See stacksjs/stacks#2926.
   */
  bare: ''
}

/**
 * The variant's classes as a `:class` object: every class any variant sets,
 * each on or off, so a live change removes the first paint's colour instead
 * of stacking on it. Classes the caller passed in `class` are left alone even
 * when a variant also uses them.
 */
export function buttonVariantToggles(variant: unknown, callerClass: unknown = ''): Record<string, boolean> {
  const own = new Set(String(callerClass || '').split(/\s+/).filter(Boolean))
  const wanted = new Set((buttonVariantClasses[String(variant)] ?? buttonVariantClasses.primary).split(/\s+/).filter(Boolean))
  const all = new Set(Object.values(buttonVariantClasses).flatMap(list => list.split(/\s+/)).filter(Boolean))
  return Object.fromEntries([...all].filter(token => !own.has(token)).map(token => [token, wanted.has(token)]))
}
