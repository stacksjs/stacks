import type { UsageState } from './types'

/**
 * What a meter does as an account approaches and passes its allowance.
 *
 * Percentages are whole numbers and every threshold is computed in integers,
 * so 120% of 500 is 600 on every machine rather than 599.9999 on some.
 */
export interface MeterPolicy {
  kind: 'soft-ingest' | 'hard-send'
  /** `warn` begins at this share of the limit. */
  warnPercent: number
  /** How far past the limit a unit is still taken in full. */
  gracePercent: number
  /** Past the grace, an ingest meter keeps one unit in this many. Unused by a send. */
  keepEvery: number
}

export type MeterPolicyName = MeterPolicy['kind']

/**
 * Ingest (errors, log lines, pageviews): never refuse. Take everything up to
 * 120% of the allowance, then keep one event in ten. A refusal would be
 * answered by an SDK retrying, which is more load for the same data.
 */
export const SOFT_INGEST: Readonly<MeterPolicy> = Object.freeze({ kind: 'soft-ingest', warnPercent: 80, gracePercent: 20, keepEvery: 10 })

/**
 * Sends (email, SMS): the caller is waiting on the answer and each unit costs
 * money, so after a 20% grace the send is refused with a typed error.
 */
export const HARD_SEND: Readonly<MeterPolicy> = Object.freeze({ kind: 'hard-send', warnPercent: 80, gracePercent: 20, keepEvery: 1 })

export function resolvePolicy(policy: MeterPolicy | MeterPolicyName | undefined): MeterPolicy {
  if (policy === undefined || policy === 'soft-ingest')
    return SOFT_INGEST
  if (policy === 'hard-send')
    return HARD_SEND
  return policy
}

export interface UsageEvaluation {
  state: UsageState
  /** Whether the unit that brought usage to `used` is taken. */
  allowed: boolean
  used: number
  limit: number | null
  /** The last count taken in full: the limit plus its grace. `null` when unlimited. */
  ceiling: number | null
}

function count(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function unlimited(limit: number | null | undefined): limit is null | undefined {
  return limit === null || limit === undefined || limit === Number.POSITIVE_INFINITY
}

/** The last count a policy takes in full: the limit plus its grace. */
export function graceCeiling(limit: number | null, policy?: MeterPolicy | MeterPolicyName): number | null {
  if (unlimited(limit))
    return null
  const allowance = count(limit)
  const { gracePercent } = resolvePolicy(policy)
  return allowance + Math.floor(allowance * count(gracePercent) / 100)
}

/**
 * Decide where `used` stands against `limit`. Pure: no clock, no randomness,
 * no I/O, so the same inputs always give the same answer.
 *
 * `used` is the count INCLUDING the unit being decided, so `allowed` answers
 * "is the unit that made it `used` taken?". To report standing usage with no
 * unit in hand, pass the current count and read only `state`.
 *
 * Past the ceiling an ingest meter keeps every `keepEvery`th unit. Which one
 * is decided by `sequence`, the number of units SEEN past the ceiling, kept
 * or not. It defaults to `used - ceiling`, which is right when `used` counts
 * everything received. A caller that counts only what it kept must pass the
 * sequence itself, or the count stops advancing on the first dropped unit and
 * every later one gets the same answer (`createCounter().admit` does this).
 */
export function evaluate(
  used: number,
  limit: number | null,
  policy?: MeterPolicy | MeterPolicyName,
  sequence?: number,
): UsageEvaluation {
  const resolved = resolvePolicy(policy)
  const total = count(used)
  if (unlimited(limit))
    return { state: 'ok', allowed: true, used: total, limit: null, ceiling: null }

  const allowance = count(limit)
  const ceiling = graceCeiling(allowance, resolved) as number
  const base = { used: total, limit: allowance, ceiling }

  if (total > ceiling) {
    if (resolved.kind === 'hard-send')
      return { ...base, state: 'over', allowed: false }
    const keepEvery = Math.max(1, count(resolved.keepEvery))
    const seen = sequence === undefined ? total - ceiling : count(sequence)
    return { ...base, state: 'sampled', allowed: seen > 0 && seen % keepEvery === 0 }
  }
  if (total >= allowance)
    return { ...base, state: 'over', allowed: true }
  if (total * 100 >= allowance * count(resolved.warnPercent))
    return { ...base, state: 'warn', allowed: true }
  return { ...base, state: 'ok', allowed: true }
}

/** A send refused because the account is past its allowance and its grace. */
export class QuotaExceededError extends Error {
  readonly code = 'quota_exceeded' as const
  readonly meter: string
  readonly used: number
  readonly limit: number
  readonly upgradeUrl: string | null

  constructor(details: { meter: string, used: number, limit: number, upgradeUrl?: string | null }) {
    super(`Usage limit exceeded for ${details.meter}: ${details.used} of ${details.limit}`)
    this.name = 'QuotaExceededError'
    this.meter = details.meter
    this.used = details.used
    this.limit = details.limit
    this.upgradeUrl = details.upgradeUrl ?? null
  }

  toJSON(): { error: 'quota_exceeded', meter: string, used: number, limit: number, upgradeUrl: string | null } {
    return { error: this.code, meter: this.meter, used: this.used, limit: this.limit, upgradeUrl: this.upgradeUrl }
  }
}

/**
 * `evaluate`, throwing `QuotaExceededError` when the unit is not taken. Meant
 * for sends; an ingest route should branch on `allowed` and still answer 2xx.
 */
export function enforceQuota(
  meter: string,
  used: number,
  limit: number | null,
  options: { policy?: MeterPolicy | MeterPolicyName, upgradeUrl?: string | null } = {},
): UsageEvaluation {
  const evaluation = evaluate(used, limit, options.policy ?? HARD_SEND)
  if (!evaluation.allowed)
    throw new QuotaExceededError({ meter, used: evaluation.used, limit: evaluation.limit ?? 0, upgradeUrl: options.upgradeUrl })
  return evaluation
}
