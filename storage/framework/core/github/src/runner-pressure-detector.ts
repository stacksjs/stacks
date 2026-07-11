/**
 * Pure runner-pressure detector (stacksjs/stacks#1850).
 *
 * Given a time-series of per-org runner samples + the dashboard's
 * memory of which orgs are currently "alerting", return the
 * actions to take: fire a fresh alert, clear an existing one, or do
 * nothing.
 *
 * **Hysteresis** matters here. Once an org has been alerted on
 * (queue > threshold sustained for one window), we DON'T re-fire
 * just because the queue spikes a second time within the same hour.
 * The org has to first *clear* — drop below threshold for a full
 * window — before another fire becomes possible. This is the
 * difference between "useful CI pressure paging" and "every dashboard
 * load spams Slack".
 *
 * Pure for the same reason as `failure-detector.ts`: easy to unit-
 * test the hysteresis transitions, the persistence + fan-out live
 * in defaults.
 */

/** One time-series row per org per snapshot refresh. */
export interface RunnerSample {
  org: string
  running: number
  queued: number
  cap: number
  /** ISO timestamp the sample was taken. Driven by the caller — we
   *  don't `Date.now()` in this module so tests can drive the clock. */
  sampledAt: string
}

/** Dashboard's last-known per-org alert state. */
export interface RunnerAlertState {
  org: string
  alerting: boolean
  /** ISO timestamp when this org most recently transitioned to
   *  alerting. Null if it has never alerted. */
  lastAlertedAt: string | null
  /** ISO timestamp when this org most recently transitioned from
   *  alerting → cleared. Null if it has never cleared (e.g. has
   *  never been in an alerting state to begin with). */
  lastClearedAt: string | null
}

/** Action the caller should take for one org. */
export interface PressureAction {
  org: string
  /**
   * - `fire`: org just crossed sustained-pressure threshold for one
   *   full window AND wasn't already alerting. Caller should
   *   notify + set `alerting = true`.
   * - `clear`: org has been below threshold for one full window AND
   *   was previously alerting. Caller should set `alerting = false`
   *   (no notification — clearing alone is silent; users only want
   *   the inbound page, not the "everything is fine again" email).
   * - `none` is not returned; the detector simply omits orgs in
   *   no-change states.
   */
  action: 'fire' | 'clear'
  /** Latest sample (so the fan-out template can show "12 queued of
   *  20 cap"). */
  current: RunnerSample
  /**
   * How long the threshold has been sustained, in milliseconds.
   * Computed from the oldest sample in the window. Reported in the
   * notification body ("queued > 8 for 12m").
   */
  sustainedMs: number
}

export interface DetectOptions {
  /** Queue depth at or above this counts as pressure. */
  queuedThreshold: number
  /** Duration the threshold must hold (in either direction) before
   *  the detector transitions. */
  windowMinutes: number
  /** Reference clock — defaults to `Date.now()`. Tests pass it in. */
  now?: number
}

/**
 * Compute the per-org actions.
 *
 * Algorithm:
 *
 *   1. Bucket samples by org.
 *   2. For each org, slice the samples within the last
 *      `windowMinutes` of `now` (called `window`).
 *   3. Skip orgs with `window.length === 0` (no samples ever) or
 *      where the window is shorter than `windowMinutes`
 *      (insufficient data — sustained-pressure can't be proven yet).
 *   4. If the org is currently `alerting`:
 *      - If every sample in the window is < threshold → emit
 *        `clear` action.
 *   5. If the org is NOT alerting:
 *      - If every sample in the window is >= threshold → emit
 *        `fire` action.
 *
 * Conditions that DON'T trigger anything:
 *
 *   - Mixed window (some above, some below threshold) → still
 *     converging; wait for the next refresh.
 *   - Sticky alerting with sustained pressure → already alerting,
 *     no new action needed.
 *   - Sticky clear with sustained calm → no action needed.
 */
export function detectRunnerPressure(
  samples: RunnerSample[],
  alertStates: Map<string, RunnerAlertState>,
  options: DetectOptions,
): PressureAction[] {
  const now = options.now ?? Date.now()
  const windowMs = options.windowMinutes * 60_000
  const cutoffMs = now - windowMs

  // Bucket samples by org.
  const byOrg = new Map<string, RunnerSample[]>()
  for (const s of samples) {
    const t = Date.parse(s.sampledAt)
    if (Number.isNaN(t) || t < cutoffMs)
      continue
    const list = byOrg.get(s.org) ?? []
    list.push(s)
    byOrg.set(s.org, list)
  }

  const actions: PressureAction[] = []

  for (const [org, orgSamples] of byOrg.entries()) {
    if (orgSamples.length === 0)
      continue

    // Sort by sampledAt ascending so [0] is oldest, [last] is newest.
    orgSamples.sort((a, b) => Date.parse(a.sampledAt) - Date.parse(b.sampledAt))

    // "Sustained for a full window" means the oldest in-window
    // sample is at least `windowMinutes` old. If the org just
    // started reporting, the window is shorter than required and
    // we can't prove sustained pressure yet.
    const oldestMs = Date.parse(orgSamples[0]!.sampledAt)
    const newestMs = Date.parse(orgSamples[orgSamples.length - 1]!.sampledAt)
    const sustainedMs = newestMs - oldestMs
    if (sustainedMs < windowMs - 1000) {
      // -1000ms tolerance — the very first sample of a fresh window
      // can be slightly less than windowMs old due to integer math
      // around the moment the boundary tips. Tests use exactly
      // `windowMinutes` spacing; tolerance keeps them deterministic
      // without making the prod boundary fuzzy.
      continue
    }

    const allAboveOrEqual = orgSamples.every(s => s.queued >= options.queuedThreshold)
    const allBelow = orgSamples.every(s => s.queued < options.queuedThreshold)
    const state = alertStates.get(org)
    const isAlerting = state?.alerting ?? false
    const current = orgSamples[orgSamples.length - 1]!

    if (isAlerting) {
      if (allBelow) {
        actions.push({ org, action: 'clear', current, sustainedMs })
      }
      // Otherwise (still elevated, or mixed) stay alerting; no action.
    }
    else {
      if (allAboveOrEqual) {
        actions.push({ org, action: 'fire', current, sustainedMs })
      }
      // Otherwise (still calm, or mixed) stay cleared; no action.
    }
  }

  return actions
}
