import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

/**
 * Cookie consent, the GDPR-correct way round (stacksjs/stacks#365).
 *
 * The rule this exists to enforce is that **non-essential cookies are declined
 * until the visitor says otherwise**. Every category except `necessary`
 * defaults to false, and there is deliberately no way to ask for a permissive
 * default: a banner whose "accept" is preselected is the single most common
 * way a consent implementation fails an audit, and making it impossible here
 * is cheaper than reviewing every app that uses it.
 *
 * The stored decision is versioned by the policy it was given under. Changing
 * `policyVersion` invalidates every stored choice and re-asks, because consent
 * to a previous policy is not consent to this one.
 *
 * Storage is `localStorage`, per browser. That is the right scope - consent is
 * a property of a device and a person, not of a session - and it means the
 * decision survives a reload without a server round trip. A visitor who blocks
 * storage gets the safe answer on every page: nothing is consented, and the
 * banner asks again.
 */

/** The categories a visitor decides about. */
export type ConsentCategory = 'necessary' | 'preferences' | 'analytics' | 'marketing'

/** Every category except the one that cannot be declined. */
export const OPTIONAL_CATEGORIES: readonly ConsentCategory[] = ['preferences', 'analytics', 'marketing']

export interface ConsentDecision {
  /** Which categories the visitor allowed. `necessary` is always true. */
  categories: Record<ConsentCategory, boolean>
  /** The policy version this decision was given under. */
  policyVersion: string
  /** When it was given, ISO-8601. */
  decidedAt: string
}

export interface UseCookieConsentOptions {
  /**
   * The current policy version. A stored decision under a different version is
   * treated as no decision - consent to a previous policy is not consent to
   * this one.
   */
  policyVersion?: string
  /** localStorage key. Versioned separately from the policy. */
  storageKey?: string
  /**
   * Called whenever a decision is made or withdrawn, including when a stored
   * decision is loaded. This is the hook for recording a `ConsentEvent`
   * server-side, or for loading the scripts a category gates.
   */
  onChange?: (decision: ConsentDecision | null) => void
}

export interface UseCookieConsentResult {
  /** The current decision, or `null` when the visitor has not decided. */
  decision: Ref<ConsentDecision | null>
  /** Whether the banner should be shown. */
  needsDecision: Ref<boolean>
  /** Whether this category is currently allowed. */
  allows: (category: ConsentCategory) => boolean
  /** Allow the listed categories, and only those. */
  accept: (categories?: readonly ConsentCategory[]) => ConsentDecision
  /** Allow everything. */
  acceptAll: () => ConsentDecision
  /** Allow nothing beyond `necessary`. */
  declineAll: () => ConsentDecision
  /** Forget the decision and ask again. */
  withdraw: () => void
}

const DEFAULT_KEY = 'stacks:cookie-consent:v1'

/** Nothing consented. The starting point, and the answer whenever in doubt. */
export function emptyCategories(): Record<ConsentCategory, boolean> {
  return { necessary: true, preferences: false, analytics: false, marketing: false }
}

/**
 * Parse a stored decision, or `null` if it is unusable.
 *
 * Anything unrecognised - a truncated write, a value from an older shape, a
 * different policy version - resolves to "no decision" rather than to a
 * partially-trusted one. The cost is asking again; the cost of the other
 * choice is running a tracker the visitor did not agree to.
 */
export function parseDecision(raw: string | null, policyVersion: string): ConsentDecision | null {
  if (!raw)
    return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object')
    return null

  const candidate = parsed as Partial<ConsentDecision>
  if (candidate.policyVersion !== policyVersion)
    return null

  if (!candidate.categories || typeof candidate.categories !== 'object')
    return null

  if (typeof candidate.decidedAt !== 'string')
    return null

  // Rebuilt from a known-empty base rather than trusted as-is, so an unknown
  // key in storage cannot introduce a category, and a missing one reads as
  // declined rather than as undefined.
  const categories = emptyCategories()
  for (const category of OPTIONAL_CATEGORIES)
    categories[category] = candidate.categories[category] === true

  return { categories, policyVersion, decidedAt: candidate.decidedAt }
}

/** Read from localStorage, tolerating an environment that has none. */
function readStored(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  }
  catch {
    // Private mode, blocked site data, SSR. The safe answer is "not decided".
    return null
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value === null)
      globalThis.localStorage?.removeItem(key)
    else
      globalThis.localStorage?.setItem(key, value)
  }
  catch {
    // A decision that cannot be persisted is still honoured for this page.
    // Failing loudly here would break the banner for a visitor whose browser
    // blocks storage, which is exactly the visitor most likely to decline.
  }
}

export function useCookieConsent(options: UseCookieConsentOptions = {}): UseCookieConsentResult {
  const policyVersion = options.policyVersion ?? '1.0'
  const storageKey = options.storageKey ?? DEFAULT_KEY

  const decision = ref<ConsentDecision | null>(
    parseDecision(readStored(storageKey), policyVersion),
  ) as Ref<ConsentDecision | null>

  const needsDecision = ref<boolean>(decision.value === null) as Ref<boolean>

  // Fired for a decision loaded from storage too: the scripts a category gates
  // have to be loaded on a return visit, not only on the visit that consented.
  if (decision.value)
    options.onChange?.(decision.value)

  function commit(categories: Record<ConsentCategory, boolean>): ConsentDecision {
    const next: ConsentDecision = {
      // `necessary` is forced rather than taken from the caller: it is the
      // category that cannot be declined, and letting it be false would
      // produce a decision the rest of the app has to special-case.
      categories: { ...categories, necessary: true },
      policyVersion,
      decidedAt: new Date().toISOString(),
    }

    decision.value = next
    needsDecision.value = false
    writeStored(storageKey, JSON.stringify(next))
    options.onChange?.(next)

    return next
  }

  return {
    decision,
    needsDecision,

    allows(category) {
      if (category === 'necessary')
        return true
      return decision.value?.categories[category] === true
    },

    accept(categories = OPTIONAL_CATEGORIES) {
      const next = emptyCategories()
      for (const category of categories) {
        if (category !== 'necessary')
          next[category] = true
      }
      return commit(next)
    },

    acceptAll() {
      const next = emptyCategories()
      for (const category of OPTIONAL_CATEGORIES)
        next[category] = true
      return commit(next)
    },

    declineAll() {
      return commit(emptyCategories())
    },

    withdraw() {
      decision.value = null
      needsDecision.value = true
      writeStored(storageKey, null)
      options.onChange?.(null)
    },
  }
}
