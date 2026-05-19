import type { RepoStatus } from './types'

/**
 * Pure failure-transition detector (stacksjs/stacks#1849).
 *
 * Given a fresh CI snapshot and the previous per-repo states the
 * dashboard knows about, return the list of repos that *just*
 * transitioned to a failed conclusion — the moment worth firing a
 * notification on. Anything still failing, or newly passing, or
 * still in flight, is silenced.
 *
 * Pure for a reason: easy to unit-test the transition matrix without
 * a DB, a notify implementation, or the network. The persistence
 * layer + notification fan-out live in defaults so framework
 * packages stay infrastructure-free.
 *
 * @see PreviousRunState  what the persistence layer hands in
 * @see FailedTransition  what we return — caller decides how to notify
 */

/** What a caller stored about a repo on its last snapshot pass. */
export interface PreviousRunState {
  /** GH "fullName" — `owner/repo`. The composite key used in storage. */
  repoFullName: string
  /** Last conclusion the dashboard saw. `null` when the repo was in
   *  flight (status pending) or had no runs yet. */
  lastConclusion: string | null
  /** GH workflow run id of the last seen run. Used to silence noise
   *  when the same failed run shows up across multiple polls — we
   *  only want to fire on a NEW run that transitioned. */
  lastRunId: number | null
  /** Last notification dispatch timestamp (ISO). Drives the cooldown
   *  window for flap-storms. `null` means "never fired". */
  lastNotifiedAt: string | null
}

/** Per-transition payload the detector hands back to the caller. */
export interface FailedTransition {
  repoFullName: string
  /** `failure`, `error`, `timed_out` — kept verbatim from snapshot. */
  conclusion: string
  /** Run id that introduced the failure. Stored back as `lastRunId`. */
  runId: number | null
  /** Pass-through metadata the notification template usually wants. */
  workflowName: string | null
  commitSha: string | null
  commitMessage: string | null
  commitAuthor: string | null
  runUrl: string | null
  /** For comparison + de-duping: the previous conclusion the detector
   *  saw before deciding this counts as a transition. */
  previousConclusion: string | null
}

export interface DetectOptions {
  /**
   * Minimum delay between consecutive notifications for the same
   * repo. Defaults to 5 minutes. A red → green → red flap inside this
   * window only fires the first transition; the second is silenced.
   *
   * Set to 0 to disable cooldown entirely.
   */
  cooldownMs?: number
  /**
   * Reference timestamp. Defaults to `Date.now()`. Injectable so the
   * test suite can drive the clock and assert cooldown semantics
   * deterministically.
   */
  now?: number
}

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000

const FAILED_CONCLUSIONS = new Set<string>([
  'failure',
  'error',
  'timed_out',
  'startup_failure',
])

function isFailed(repo: { status: string, conclusion: string | null }): boolean {
  // `RepoStatus.status` covers our internal bucket (success / failure /
  // pending / error / no_runs). `failure` and `error` both count;
  // `conclusion` adds GH's finer-grained terminology (timed_out,
  // startup_failure) for the cases that surfaced as `error` upstream.
  if (repo.status === 'failure' || repo.status === 'error')
    return true
  if (repo.conclusion && FAILED_CONCLUSIONS.has(repo.conclusion))
    return true
  return false
}

function isInFlight(repo: { status: string }): boolean {
  return repo.status === 'pending'
}

/**
 * Compute the failed-transition list.
 *
 * The "transition" is gated on:
 *
 *   1. The repo is currently in a failed state.
 *   2. The repo is NOT in flight (pending). Pending → failure happens
 *      mid-run; firing on it would just produce noise once the run
 *      finishes and the same failure resurfaces with a final
 *      conclusion.
 *   3. The previous state was *not* failed. (Sticky-red repos don't
 *      keep firing.)
 *   4. The run id changed — if the same failed run id is still
 *      surfacing, this is a duplicate poll, not a new failure.
 *   5. Cooldown: `lastNotifiedAt` is either null or older than
 *      `cooldownMs` ago.
 */
export function detectNewlyFailedRuns(
  snapshot: { repos: RepoStatus[] },
  previousStates: Map<string, PreviousRunState>,
  options: DetectOptions = {},
): FailedTransition[] {
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS
  const now = options.now ?? Date.now()
  const transitions: FailedTransition[] = []

  for (const repo of snapshot.repos) {
    if (!isFailed(repo) || isInFlight(repo))
      continue

    const prev = previousStates.get(repo.fullName)
    const prevWasFailed = prev?.lastConclusion
      ? FAILED_CONCLUSIONS.has(prev.lastConclusion) || prev.lastConclusion === 'failure' || prev.lastConclusion === 'error'
      : false
    if (prevWasFailed) {
      // The repo is still red. Only count this as a transition if
      // the run id has changed — i.e. a new failed run, not the same
      // one surfacing again.
      const currentRunId = parseRunIdFromUrl(repo.runUrl)
      if (currentRunId !== null && prev?.lastRunId !== null && currentRunId === prev?.lastRunId)
        continue
      // Different run id while still failing — counts as a new
      // transition (a fresh failed build after the previous one).
      // BUT silence it if we already notified within the cooldown.
      if (prev?.lastNotifiedAt && isWithinCooldown(prev.lastNotifiedAt, cooldownMs, now))
        continue
      transitions.push(toTransition(repo, prev?.lastConclusion ?? null))
      continue
    }

    // Previously green / pending / no_runs / never-seen → now failed.
    // The transition we care about. Still honour the cooldown — covers
    // the "green → red → green → red" flap-storm case where the
    // intermediate green resets `prevWasFailed` but the user still
    // doesn't want to be paged twice in 30s.
    if (prev?.lastNotifiedAt && isWithinCooldown(prev.lastNotifiedAt, cooldownMs, now))
      continue

    transitions.push(toTransition(repo, prev?.lastConclusion ?? null))
  }

  return transitions
}

function isWithinCooldown(lastNotifiedAt: string, cooldownMs: number, now: number): boolean {
  if (cooldownMs === 0) return false
  const ts = Date.parse(lastNotifiedAt)
  if (Number.isNaN(ts)) return false
  return (now - ts) < cooldownMs
}

/**
 * Extract the run id from a GH run URL like
 * `https://github.com/owner/repo/actions/runs/12345678`. Returns null
 * if the URL doesn't match — we don't blow up the detector on
 * unfamiliar URL shapes; we just fall through to "treat as a new run".
 */
function parseRunIdFromUrl(runUrl: string | null): number | null {
  if (!runUrl) return null
  const match = runUrl.match(/\/actions\/runs\/(\d+)/)
  if (!match) return null
  const id = Number(match[1])
  return Number.isFinite(id) ? id : null
}

function toTransition(repo: RepoStatus, previousConclusion: string | null): FailedTransition {
  return {
    repoFullName: repo.fullName,
    conclusion: repo.conclusion ?? repo.status,
    runId: parseRunIdFromUrl(repo.runUrl),
    workflowName: repo.workflowName,
    commitSha: repo.commitSha,
    commitMessage: repo.commitMessage,
    commitAuthor: repo.commitAuthor,
    runUrl: repo.runUrl,
    previousConclusion,
  }
}
