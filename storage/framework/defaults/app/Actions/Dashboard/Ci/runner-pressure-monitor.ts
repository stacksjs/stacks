/**
 * Runner-pressure monitor (stacksjs/stacks#1850).
 *
 * Bridges the pure `detectRunnerPressure()` from @stacksjs/github
 * with the persistence layer (`ci_runner_samples` + `ci_runner_alert_states`)
 * and the notification fan-out from #1849.
 *
 * Call from the CI StatusAction after a fresh snapshot resolves:
 *
 *   void runRunnerPressureMonitor(snapshot)
 *
 * Same fire-and-forget pattern as the failure notifier — never
 * block the response on the persistence + fan-out round-trips.
 *
 * The cycle:
 *
 *   1. Skip entirely if `ci.alerts.enabled` is false.
 *   2. Append a sample row per org from the current snapshot.
 *   3. Prune samples older than `retentionHours`.
 *   4. Load the last `windowMinutes` of samples + the current alert
 *      states.
 *   5. Run the pure detector.
 *   6. For each `fire`/`clear` action: update the alert-state row.
 *      Only `fire` triggers a notification — clearing is silent.
 */

import type { DashboardData, PressureAction, RunnerAlertState, RunnerSample } from '@stacksjs/github'
import { dashboard as dashboardConfig } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { detectRunnerPressure } from '@stacksjs/github'
import { notify } from '@stacksjs/notifications'

interface SampleRow {
  org: string
  running: number
  queued: number
  cap: number
  sampled_at: string
}

interface AlertStateRow {
  org: string
  alerting: number
  last_alerted_at: string | null
  last_cleared_at: string | null
}

async function appendSamples(snapshot: DashboardData, nowIso: string): Promise<void> {
  const runners = snapshot.runners ?? {}
  const orgs = Object.keys(runners)
  if (orgs.length === 0)
    return
  // Insert one row per org. Cross-dialect multi-row INSERT keeps it
  // a single round-trip even for the typical 5-org fleet.
  const rows = orgs.map((org) => {
    const r = runners[org]
    return { org, running: r.running, queued: r.queued, cap: r.cap, sampled_at: nowIso }
  })
  await db.insertInto('ci_runner_samples').values(rows as any).execute()
}

async function pruneOldSamples(retentionHours: number, nowMs: number): Promise<void> {
  const cutoffIso = new Date(nowMs - retentionHours * 60 * 60_000).toISOString()
  await db.deleteFrom('ci_runner_samples')
    .where('sampled_at', '<', cutoffIso)
    .execute()
}

async function loadWindowSamples(windowMinutes: number, nowMs: number): Promise<RunnerSample[]> {
  const cutoffIso = new Date(nowMs - windowMinutes * 60_000).toISOString()
  const rows = await db.unsafe(
    'SELECT org, running, queued, cap, sampled_at FROM ci_runner_samples WHERE sampled_at >= ? ORDER BY sampled_at ASC',
    [cutoffIso],
  ).execute() as SampleRow[]

  return (rows ?? []).map((r): RunnerSample => ({
    org: r.org,
    running: Number(r.running),
    queued: Number(r.queued),
    cap: Number(r.cap),
    sampledAt: r.sampled_at,
  }))
}

async function loadAlertStates(): Promise<Map<string, RunnerAlertState>> {
  const rows = await db.unsafe(
    'SELECT org, alerting, last_alerted_at, last_cleared_at FROM ci_runner_alert_states',
  ).execute() as AlertStateRow[]

  const map = new Map<string, RunnerAlertState>()
  for (const r of rows ?? []) {
    map.set(r.org, {
      org: r.org,
      alerting: Number(r.alerting) === 1,
      lastAlertedAt: r.last_alerted_at,
      lastClearedAt: r.last_cleared_at,
    })
  }
  return map
}

async function upsertAlertState(org: string, alerting: boolean, nowIso: string): Promise<void> {
  // Cross-dialect upsert: SELECT-then-INSERT/UPDATE. Same shape as
  // the failure-notifier's state writes — keep the patterns
  // consistent so future maintainers don't second-guess the
  // dialect choice in one place vs another.
  const existing = await db.unsafe(
    'SELECT org FROM ci_runner_alert_states WHERE org = ? LIMIT 1',
    [org],
  ).execute() as Array<{ org: string }>

  if (existing?.length) {
    const set: Record<string, unknown> = {
      alerting: alerting ? 1 : 0,
      updated_at: nowIso,
    }
    if (alerting) set.last_alerted_at = nowIso
    else set.last_cleared_at = nowIso
    await db.updateTable('ci_runner_alert_states').set(set as any).where('org', '=', org).execute()
  }
  else {
    await db.insertInto('ci_runner_alert_states').values({
      org,
      alerting: alerting ? 1 : 0,
      last_alerted_at: alerting ? nowIso : null,
      last_cleared_at: alerting ? null : nowIso,
      updated_at: nowIso,
    } as any).execute()
  }
}

function buildPayload(action: PressureAction): { subject: string, body: string, data: Record<string, unknown> } {
  const { org, current, sustainedMs } = action
  const minutes = Math.round(sustainedMs / 60_000)
  const subject = `Runner pressure: ${org} — ${current.queued} queued`
  const body = [
    `Org: ${org}`,
    `Queue depth: ${current.queued} (cap ${current.cap}, ${current.running} running)`,
    `Sustained for: ${minutes}m`,
  ].join('\n')
  return {
    subject,
    body,
    data: {
      org,
      running: current.running,
      queued: current.queued,
      cap: current.cap,
      sustainedMs,
    },
  }
}

export async function runRunnerPressureMonitor(snapshot: DashboardData): Promise<void> {
  const ci = dashboardConfig?.ci
  const alerts = ci?.alerts
  if (!alerts?.enabled || !snapshot.runners || Object.keys(snapshot.runners).length === 0)
    return

  const queuedThreshold = alerts.queuedThreshold ?? 8
  const windowMinutes = alerts.windowMinutes ?? 10
  const retentionHours = alerts.retentionHours ?? 24
  const channels = (alerts.channels ?? ['chat']) as Array<'email' | 'sms' | 'chat' | 'database'>
  const recipients = alerts.recipients ?? []

  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()

  try {
    // Step 1+2: append the new sample, prune old.
    await appendSamples(snapshot, nowIso)
    await pruneOldSamples(retentionHours, nowMs)

    // Step 3+4: load window + alert states.
    const [windowSamples, states] = await Promise.all([
      loadWindowSamples(windowMinutes, nowMs),
      loadAlertStates(),
    ])

    // Step 5: detect.
    const actions = detectRunnerPressure(windowSamples, states, {
      queuedThreshold,
      windowMinutes,
      now: nowMs,
    })

    // Step 6: act on each transition.
    for (const a of actions) {
      // State write first so the next refresh has the right baseline
      // even if the notification fan-out throws.
      await upsertAlertState(a.org, a.action === 'fire', nowIso)

      if (a.action !== 'fire')
        continue

      const payload = buildPayload(a)
      const broadcastChannels = channels.filter(c => c === 'chat')
      const recipientChannels = channels.filter(c => c !== 'chat')

      if (broadcastChannels.length > 0) {
        try {
          await notify({}, payload, broadcastChannels, { ignorePreferences: true })
        }
        catch (err) {
          console.warn('[runner-pressure-monitor] chat broadcast failed:', err)
        }
      }
      if (recipientChannels.length > 0 && recipients.length > 0) {
        for (const r of recipients) {
          try {
            await notify(r, payload, recipientChannels, { ignorePreferences: true })
          }
          catch (err) {
            console.warn('[runner-pressure-monitor] notify failed:', err)
          }
        }
      }
    }
  }
  catch (err) {
    console.warn('[runner-pressure-monitor] cycle failed:', err)
  }
}

/**
 * Fetch the recent runner-sample history for one org — used by the
 * sparkline UI. Returns ASC order by `sampledAt` so the SVG path
 * builder can map index → x without sorting.
 *
 * Bounded by `retentionHours` (defaults to 24) so a misconfigured
 * caller can't accidentally pull the entire table.
 */
export async function fetchRunnerHistory(
  org: string,
  options: { limit?: number, retentionHours?: number } = {},
): Promise<RunnerSample[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 60, 500))
  const retentionHours = options.retentionHours ?? 24
  const cutoffIso = new Date(Date.now() - retentionHours * 60 * 60_000).toISOString()

  // ASC-by-newest then re-reverse so we get the N most recent samples
  // in ASC order (oldest → newest) — what the sparkline path needs.
  const rows = await db.unsafe(
    `SELECT org, running, queued, cap, sampled_at
    FROM ci_runner_samples
    WHERE org = ? AND sampled_at >= ?
    ORDER BY sampled_at DESC
    LIMIT ?`,
    [org, cutoffIso, limit],
  ).execute() as SampleRow[]

  return (rows ?? []).reverse().map((r): RunnerSample => ({
    org: r.org,
    running: Number(r.running),
    queued: Number(r.queued),
    cap: Number(r.cap),
    sampledAt: r.sampled_at,
  }))
}
