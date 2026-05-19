/**
 * CI failure notifier (stacksjs/stacks#1849).
 *
 * Bridges the pure `detectNewlyFailedRuns()` from @stacksjs/github
 * with the persistence layer (the `ci_run_states` table) and the
 * notification fan-out (`notify()` from @stacksjs/notifications).
 *
 * Lives in defaults — not in @stacksjs/github — because it pulls in
 * the DB + notify infrastructure that the pure helper deliberately
 * stays free of.
 *
 * Call from the CI StatusAction after a fresh snapshot resolves:
 *
 *   void runCiFailureNotifier(snapshot)
 *
 * `void` because we don't want to block the response on the
 * notification round-trips. The fan-out happens behind the user's
 * back; any failure is logged but doesn't bubble.
 */

import type { DashboardData, FailedTransition, PreviousRunState } from '@stacksjs/github'
import { dashboard as dashboardConfig } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { detectNewlyFailedRuns } from '@stacksjs/github'
import { notify } from '@stacksjs/notifications'

interface CiRunStateRow {
  repo_full_name: string
  last_conclusion: string | null
  last_run_id: number | null
  last_seen_at: string | null
  last_notified_at: string | null
}

/** Load the dashboard's last-seen state for every repo in one query. */
async function loadPreviousStates(): Promise<Map<string, PreviousRunState>> {
  const rows = await db.unsafe(
    'SELECT repo_full_name, last_conclusion, last_run_id, last_notified_at FROM ci_run_states',
  ).execute() as CiRunStateRow[]

  const map = new Map<string, PreviousRunState>()
  for (const r of rows ?? []) {
    map.set(r.repo_full_name, {
      repoFullName: r.repo_full_name,
      lastConclusion: r.last_conclusion,
      lastRunId: r.last_run_id == null ? null : Number(r.last_run_id),
      lastNotifiedAt: r.last_notified_at,
    })
  }
  return map
}

/**
 * Upsert every repo in the snapshot's current state. Doesn't touch
 * `last_notified_at` — that's owned by the notifier and only bumped
 * when we actually fire.
 */
async function upsertSnapshotStates(snapshot: DashboardData): Promise<void> {
  if (!snapshot.repos?.length) return
  const nowIso = new Date().toISOString()
  for (const r of snapshot.repos) {
    const runId = parseRunIdFromUrl(r.runUrl)
    // Two-step upsert — works across SQLite/MySQL/Postgres without
    // dialect-specific ON CONFLICT shapes. Each repo is its own
    // round-trip, but the table is small (one row per repo, so
    // typically O(50) for a busy fleet) and this runs in the
    // background after the response goes out.
    const existing = await db.unsafe(
      'SELECT repo_full_name FROM ci_run_states WHERE repo_full_name = ? LIMIT 1',
      [r.fullName],
    ).execute() as Array<{ repo_full_name: string }>
    if (existing?.length) {
      await db.updateTable('ci_run_states').set({
        last_conclusion: r.conclusion ?? r.status,
        last_run_id: runId,
        last_seen_at: nowIso,
        updated_at: nowIso,
      } as any).where('repo_full_name', '=', r.fullName).execute()
    }
    else {
      await db.insertInto('ci_run_states').values({
        repo_full_name: r.fullName,
        last_conclusion: r.conclusion ?? r.status,
        last_run_id: runId,
        last_seen_at: nowIso,
        updated_at: nowIso,
      } as any).execute()
    }
  }
}

/** Bump `last_notified_at` for the repos we just fired on. */
async function markNotified(transitions: FailedTransition[]): Promise<void> {
  if (!transitions.length) return
  const nowIso = new Date().toISOString()
  for (const t of transitions) {
    await db.updateTable('ci_run_states')
      .set({ last_notified_at: nowIso } as any)
      .where('repo_full_name', '=', t.repoFullName)
      .execute()
  }
}

function parseRunIdFromUrl(runUrl: string | null): number | null {
  if (!runUrl) return null
  const match = runUrl.match(/\/actions\/runs\/(\d+)/)
  if (!match) return null
  const id = Number(match[1])
  return Number.isFinite(id) ? id : null
}

/** Build the human-readable payload for a single transition. */
function buildPayload(t: FailedTransition): { subject: string, body: string, data: Record<string, unknown> } {
  const shortSha = t.commitSha ? t.commitSha.slice(0, 7) : ''
  const commit = t.commitMessage ? `${shortSha} ${t.commitMessage.split('\n')[0]}` : shortSha
  const workflow = t.workflowName ? ` (${t.workflowName})` : ''
  const author = t.commitAuthor ? ` — ${t.commitAuthor}` : ''
  const subject = `CI failed: ${t.repoFullName}${workflow}`
  const lines = [
    `${t.repoFullName}${workflow}`,
    `Conclusion: ${t.conclusion}`,
  ]
  if (commit) lines.push(`Commit: ${commit}${author}`)
  if (t.runUrl) lines.push(`Run: ${t.runUrl}`)
  return {
    subject,
    body: lines.join('\n'),
    data: {
      repoFullName: t.repoFullName,
      runId: t.runId,
      runUrl: t.runUrl,
      conclusion: t.conclusion,
      previousConclusion: t.previousConclusion,
      commitSha: t.commitSha,
    },
  }
}

/**
 * Run the full detect → notify → persist cycle for a fresh snapshot.
 *
 * Caller pattern: `void runCiFailureNotifier(snapshot)` from the
 * StatusAction. The cycle:
 *
 *   1. Skip entirely if `ci.notifications.enabled` is false.
 *   2. Load previous states from `ci_run_states`.
 *   3. Run the pure detector with the configured cooldown.
 *   4. For each transition, fan out via `notify()` to every
 *      configured recipient × channel combination.
 *      - `chat` channel doesn't need recipients (it broadcasts to
 *        the configured Slack channel) — emit one notification with
 *        no recipient details.
 *      - Email / sms / database channels iterate the
 *        `recipients` list.
 *   5. Upsert the current state for every repo (so next call has a
 *      diff baseline).
 *   6. Bump `last_notified_at` for the repos we fired on.
 *
 * Errors at any step are logged and swallowed — a broken notifier
 * must never take down the dashboard's read path.
 */
export async function runCiFailureNotifier(snapshot: DashboardData): Promise<void> {
  const ci = dashboardConfig?.ci
  const notifs = ci?.notifications
  if (!notifs?.enabled || !snapshot.repos?.length)
    return

  const channels = (notifs.channels ?? ['chat']) as Array<'email' | 'sms' | 'chat' | 'database'>
  const cooldownMs = (notifs.cooldownMinutes ?? 5) * 60_000
  const recipients = notifs.recipients ?? []

  try {
    const previousStates = await loadPreviousStates()
    const transitions = detectNewlyFailedRuns(snapshot, previousStates, { cooldownMs })

    // Fan out. Each transition fires once per (recipient × channel)
    // combination. For channels that don't need a recipient (chat),
    // we still fire once per transition with an empty recipient
    // record — the chat driver ignores recipient fields.
    for (const t of transitions) {
      const payload = buildPayload(t)
      const broadcastChannels = channels.filter(c => c === 'chat')
      const recipientChannels = channels.filter(c => c !== 'chat')

      if (broadcastChannels.length > 0) {
        try {
          await notify({}, payload, broadcastChannels, { ignorePreferences: true })
        }
        catch (err) {
          console.warn('[ci-failure-notifier] chat broadcast failed:', err)
        }
      }
      if (recipientChannels.length > 0 && recipients.length > 0) {
        for (const r of recipients) {
          try {
            await notify(r, payload, recipientChannels, { ignorePreferences: true })
          }
          catch (err) {
            console.warn('[ci-failure-notifier] notify failed:', err)
          }
        }
      }
    }

    // Order matters: upsert states FIRST so the next refresh sees
    // the current conclusion + run id, then mark-notified to update
    // `last_notified_at` on the rows we fired on.
    await upsertSnapshotStates(snapshot)
    await markNotified(transitions)
  }
  catch (err) {
    console.warn('[ci-failure-notifier] cycle failed:', err)
  }
}
