/**
 * When each part of a digital product opens for a buyer: the videos of a
 * series, the weeks of a training plan or a course. Pure and dependency-free,
 * so the browser bundles it (`@stacksjs/commerce/releases`) and a server
 * decides the same way.
 *
 * - `all_at_once`: every unit at the anchor.
 * - `drip`: the first `initialCount` units at the anchor, then one more every
 *   `intervalDays`. A video's own `offsetDays` overrides its slot.
 * - `scheduled`: the same dates for every buyer, from `startsAt`, stepping the
 *   same way. A video's own `releaseAt` overrides its slot. Someone buying
 *   late gets everything already released.
 *
 * The anchor is the purchase, but never before launch: a product whose
 * `startsAt` is still ahead is a pre-sale, and nothing opens until then.
 */

export const RELEASE_MODES = ['all_at_once', 'drip', 'scheduled'] as const
export type ReleaseMode = typeof RELEASE_MODES[number]

export interface RolloutConfig {
  mode: ReleaseMode
  intervalDays: number
  initialCount: number
  /** ISO timestamp: launch (all modes) and the schedule's first release. */
  startsAt: string | null
}

export interface UnitOverride {
  offsetDays?: number | null
  releaseAt?: string | null
}

export interface UnitRelease {
  index: number
  unlock_at: string
  unlocked: boolean
}

const DAY_MS = 86_400_000

export function isReleaseMode(value: unknown): value is ReleaseMode {
  return typeof value === 'string' && (RELEASE_MODES as readonly string[]).includes(value)
}

/** The product row's columns as a config, with the defaults filled in. */
export function rolloutFromProduct(product: { release_mode?: unknown, release_interval_days?: unknown, release_initial_count?: unknown, release_starts_at?: unknown }): RolloutConfig {
  const interval = Number(product.release_interval_days)
  const initial = Number(product.release_initial_count)
  const startsAt = parseTime(product.release_starts_at)
  return {
    mode: isReleaseMode(product.release_mode) ? product.release_mode : 'all_at_once',
    intervalDays: Number.isInteger(interval) && interval > 0 ? interval : 7,
    initialCount: Number.isInteger(initial) && initial > 0 ? initial : 1,
    startsAt: startsAt === null ? null : new Date(startsAt).toISOString(),
  }
}

function parseTime(value: unknown): number | null {
  if (value == null || value === '') return null
  const time = new Date(String(value)).getTime()
  return Number.isFinite(time) ? time : null
}

/** How many interval steps past the initial batch unit `index` (0-based) sits. */
function stepsFor(config: RolloutConfig, index: number): number {
  return Math.max(0, index - (config.initialCount - 1))
}

/** When unit `index` unlocks for a buyer whose clock starts at `purchasedAt`. */
export function unlockAt(config: RolloutConfig, index: number, purchasedAt: Date, override: UnitOverride = {}): Date {
  const launch = parseTime(config.startsAt)
  const anchor = Math.max(purchasedAt.getTime(), launch ?? 0)

  if (config.mode === 'scheduled') {
    const fixed = parseTime(override.releaseAt)
    if (fixed !== null) return new Date(fixed)
    const base = launch ?? purchasedAt.getTime()
    return new Date(base + stepsFor(config, index) * config.intervalDays * DAY_MS)
  }

  if (config.mode === 'drip') {
    const offset = override.offsetDays
    if (offset != null && Number.isFinite(Number(offset)) && Number(offset) >= 0)
      return new Date(anchor + Number(offset) * DAY_MS)
    return new Date(anchor + stepsFor(config, index) * config.intervalDays * DAY_MS)
  }

  return new Date(anchor)
}

/** The release of every unit, in order, and whether it is open at `now`. */
export function releaseSchedule(config: RolloutConfig, count: number, purchasedAt: Date, now: Date, overrides: UnitOverride[] = []): UnitRelease[] {
  const units: UnitRelease[] = []
  for (let index = 0; index < count; index++) {
    const at = unlockAt(config, index, purchasedAt, overrides[index] || {})
    units.push({ index, unlock_at: at.toISOString(), unlocked: at.getTime() <= now.getTime() })
  }
  return units
}

/**
 * How many leading units are open. A plan's weeks are written to the calendar
 * in order, so an early week never waits behind a later one that opened first
 * (possible with per-video overrides, which plans do not have).
 */
export function unlockedPrefix(schedule: UnitRelease[]): number {
  let count = 0
  for (const unit of schedule) {
    if (!unit.unlocked) break
    count++
  }
  return count
}

/** A sentence for the product page: what a buyer gets, and when. */
export function describeRollout(config: RolloutConfig, count: number, unit: 'video' | 'week', now: Date = new Date()): string {
  const plural = (n: number) => `${n} ${unit}${n === 1 ? '' : 's'}`
  const launch = parseTime(config.startsAt)
  const launchText = launch !== null && launch > now.getTime()
    ? ` from ${new Date(launch).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
    : ''
  if (count <= 0) return ''
  if (count === 1) return `Available${launchText || ' immediately'}.`
  if (config.mode === 'all_at_once' || count <= config.initialCount)
    return `All ${plural(count)} available${launchText || ' immediately'}.`
  const every = config.intervalDays === 1 ? 'every day' : config.intervalDays === 7 ? 'every week' : `every ${config.intervalDays} days`
  const one = config.initialCount === 1
  const start = one ? `The first ${unit}` : `The first ${plural(config.initialCount)}`
  if (config.mode === 'drip')
    return `${start} ${one ? 'unlocks' : 'unlock'}${launchText || ' on purchase'}, then one more ${every}.`
  if (launchText)
    return `${start} ${one ? 'releases' : 'release'} on ${launchText.slice(6)}, then one more ${every}, on the same dates for everyone.`
  const since = launch === null ? '' : ` since ${new Date(launch).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
  return `Releasing on a shared schedule${since}, one more ${unit} ${every}. Join now and everything already out is yours.`
}
