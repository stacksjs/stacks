/**
 * Tests for the pure failure-transition detector
 * (stacksjs/stacks#1849).
 *
 * Pure-function tests — no DB, no network. The whole point of
 * splitting the detector out from the persistence layer is so the
 * transition matrix is hammered here.
 */

import type { PreviousRunState } from '../src/failure-detector'
import type { RepoStatus, RepoStatusKind } from '../src/types'
import { describe, expect, test } from 'bun:test'
import { detectNewlyFailedRuns } from '../src/failure-detector'

function buildRepo(overrides: Partial<RepoStatus> & { name: string }): RepoStatus {
  // Spread-merge instead of `??` defaults so explicit `null` overrides
  // a default value (e.g. `runUrl: null` in a test really sets null,
  // doesn't fall back to the default URL).
  return {
    name: overrides.name,
    owner: 'org',
    fullName: `org/${overrides.name}`,
    url: 'https://github.com/org/repo',
    defaultBranch: 'main',
    status: 'success',
    conclusion: 'success',
    workflowName: 'CI',
    commitSha: 'abc1234',
    commitMessage: null,
    commitUrl: null,
    commitAuthor: null,
    commitCount: null,
    updatedAt: null,
    runUrl: 'https://github.com/org/repo/actions/runs/100',
    failedJobs: [],
    renovatePRs: 0,
    renovatePRsUrl: null,
    actionsPRs: 0,
    actionsPRsUrl: null,
    ...overrides,
  }
}

const NOW = Date.parse('2026-05-20T12:00:00Z')

describe('detectNewlyFailedRuns — transition matrix', () => {
  test('green → red fires a transition', () => {
    const snapshot = { repos: [buildRepo({ name: 'a', status: 'failure' as RepoStatusKind, conclusion: 'failure' })] }
    const previous = new Map<string, PreviousRunState>([
      ['org/a', { repoFullName: 'org/a', lastConclusion: 'success', lastRunId: 99, lastNotifiedAt: null }],
    ])
    const result = detectNewlyFailedRuns(snapshot, previous, { now: NOW })
    expect(result.length).toBe(1)
    expect(result[0].repoFullName).toBe('org/a')
    expect(result[0].previousConclusion).toBe('success')
  })

  test('first-ever-seen (no previous state) and failed fires', () => {
    const snapshot = { repos: [buildRepo({ name: 'b', status: 'failure' as RepoStatusKind, conclusion: 'failure' })] }
    const result = detectNewlyFailedRuns(snapshot, new Map(), { now: NOW })
    expect(result.length).toBe(1)
    expect(result[0].previousConclusion).toBeNull()
  })

  test('sticky red — previous was failed, same run id → no fire', () => {
    const snapshot = { repos: [buildRepo({ name: 'c', status: 'failure' as RepoStatusKind, conclusion: 'failure', runUrl: 'https://github.com/org/c/actions/runs/100' })] }
    const previous = new Map<string, PreviousRunState>([
      ['org/c', { repoFullName: 'org/c', lastConclusion: 'failure', lastRunId: 100, lastNotifiedAt: null }],
    ])
    const result = detectNewlyFailedRuns(snapshot, previous, { now: NOW })
    expect(result.length).toBe(0)
  })

  test('sticky red — previous failed but DIFFERENT run id → fires (new red build)', () => {
    const snapshot = { repos: [buildRepo({ name: 'd', status: 'failure' as RepoStatusKind, conclusion: 'failure', runUrl: 'https://github.com/org/d/actions/runs/200' })] }
    const previous = new Map<string, PreviousRunState>([
      ['org/d', { repoFullName: 'org/d', lastConclusion: 'failure', lastRunId: 100, lastNotifiedAt: null }],
    ])
    const result = detectNewlyFailedRuns(snapshot, previous, { now: NOW })
    expect(result.length).toBe(1)
  })

  test('still passing → no fire', () => {
    const snapshot = { repos: [buildRepo({ name: 'e', status: 'success' as RepoStatusKind, conclusion: 'success' })] }
    const previous = new Map<string, PreviousRunState>([
      ['org/e', { repoFullName: 'org/e', lastConclusion: 'success', lastRunId: 100, lastNotifiedAt: null }],
    ])
    const result = detectNewlyFailedRuns(snapshot, previous, { now: NOW })
    expect(result.length).toBe(0)
  })

  test('pending → no fire (mid-run; final conclusion will be detected next refresh)', () => {
    const snapshot = { repos: [buildRepo({ name: 'f', status: 'pending' as RepoStatusKind, conclusion: 'in_progress' })] }
    const previous = new Map<string, PreviousRunState>([
      ['org/f', { repoFullName: 'org/f', lastConclusion: 'success', lastRunId: 100, lastNotifiedAt: null }],
    ])
    const result = detectNewlyFailedRuns(snapshot, previous, { now: NOW })
    expect(result.length).toBe(0)
  })

  test('error status counts as a failed transition', () => {
    const snapshot = { repos: [buildRepo({ name: 'g', status: 'error' as RepoStatusKind, conclusion: null })] }
    const result = detectNewlyFailedRuns(snapshot, new Map(), { now: NOW })
    expect(result.length).toBe(1)
  })

  test('timed_out / startup_failure conclusions count as failed', () => {
    const snapshot = {
      repos: [
        buildRepo({ name: 'h1', status: 'failure' as RepoStatusKind, conclusion: 'timed_out' }),
        buildRepo({ name: 'h2', status: 'failure' as RepoStatusKind, conclusion: 'startup_failure' }),
      ],
    }
    const result = detectNewlyFailedRuns(snapshot, new Map(), { now: NOW })
    expect(result.length).toBe(2)
  })

  test('cancelled conclusion does NOT count as failed', () => {
    const snapshot = { repos: [buildRepo({ name: 'i', status: 'success' as RepoStatusKind, conclusion: 'cancelled' })] }
    const result = detectNewlyFailedRuns(snapshot, new Map(), { now: NOW })
    expect(result.length).toBe(0)
  })
})

describe('detectNewlyFailedRuns — cooldown', () => {
  test('inside cooldown window — silenced', () => {
    const lastNotifiedAt = new Date(NOW - 60_000).toISOString() // 1m ago
    const snapshot = { repos: [buildRepo({ name: 'a', status: 'failure' as RepoStatusKind, conclusion: 'failure', runUrl: 'https://github.com/org/a/actions/runs/300' })] }
    const previous = new Map<string, PreviousRunState>([
      ['org/a', { repoFullName: 'org/a', lastConclusion: 'failure', lastRunId: 100, lastNotifiedAt }],
    ])
    const result = detectNewlyFailedRuns(snapshot, previous, { now: NOW, cooldownMs: 5 * 60_000 })
    expect(result.length).toBe(0)
  })

  test('outside cooldown window — fires', () => {
    const lastNotifiedAt = new Date(NOW - 10 * 60_000).toISOString() // 10m ago
    const snapshot = { repos: [buildRepo({ name: 'a', status: 'failure' as RepoStatusKind, conclusion: 'failure', runUrl: 'https://github.com/org/a/actions/runs/300' })] }
    const previous = new Map<string, PreviousRunState>([
      ['org/a', { repoFullName: 'org/a', lastConclusion: 'failure', lastRunId: 100, lastNotifiedAt }],
    ])
    const result = detectNewlyFailedRuns(snapshot, previous, { now: NOW, cooldownMs: 5 * 60_000 })
    expect(result.length).toBe(1)
  })

  test('green → red inside cooldown — silenced (covers flap-storm)', () => {
    // Previous green, but the same repo just got notified 30s ago
    // (which can happen on a red → green → red flap).
    const lastNotifiedAt = new Date(NOW - 30_000).toISOString()
    const snapshot = { repos: [buildRepo({ name: 'a', status: 'failure' as RepoStatusKind, conclusion: 'failure' })] }
    const previous = new Map<string, PreviousRunState>([
      ['org/a', { repoFullName: 'org/a', lastConclusion: 'success', lastRunId: 99, lastNotifiedAt }],
    ])
    const result = detectNewlyFailedRuns(snapshot, previous, { now: NOW, cooldownMs: 5 * 60_000 })
    expect(result.length).toBe(0)
  })

  test('cooldownMs: 0 disables cooldown entirely', () => {
    const lastNotifiedAt = new Date(NOW - 1000).toISOString() // 1s ago
    const snapshot = { repos: [buildRepo({ name: 'a', status: 'failure' as RepoStatusKind, conclusion: 'failure' })] }
    const previous = new Map<string, PreviousRunState>([
      ['org/a', { repoFullName: 'org/a', lastConclusion: 'success', lastRunId: 99, lastNotifiedAt }],
    ])
    const result = detectNewlyFailedRuns(snapshot, previous, { now: NOW, cooldownMs: 0 })
    expect(result.length).toBe(1)
  })

  test('malformed lastNotifiedAt is treated as "never fired" (defensive)', () => {
    const snapshot = { repos: [buildRepo({ name: 'a', status: 'failure' as RepoStatusKind, conclusion: 'failure' })] }
    const previous = new Map<string, PreviousRunState>([
      ['org/a', { repoFullName: 'org/a', lastConclusion: 'success', lastRunId: 99, lastNotifiedAt: 'not-a-date' }],
    ])
    const result = detectNewlyFailedRuns(snapshot, previous, { now: NOW })
    expect(result.length).toBe(1)
  })
})

describe('detectNewlyFailedRuns — run id parsing', () => {
  test('extracts run id from canonical GH URL', () => {
    const snapshot = { repos: [buildRepo({ name: 'a', status: 'failure' as RepoStatusKind, conclusion: 'failure', runUrl: 'https://github.com/org/a/actions/runs/123456' })] }
    const result = detectNewlyFailedRuns(snapshot, new Map(), { now: NOW })
    expect(result[0].runId).toBe(123456)
  })

  test('returns null run id when URL doesn\'t match', () => {
    const snapshot = { repos: [buildRepo({ name: 'a', status: 'failure' as RepoStatusKind, conclusion: 'failure', runUrl: 'https://example.com/x' })] }
    const result = detectNewlyFailedRuns(snapshot, new Map(), { now: NOW })
    expect(result[0].runId).toBeNull()
  })

  test('returns null run id when runUrl is missing', () => {
    const snapshot = { repos: [buildRepo({ name: 'a', status: 'failure' as RepoStatusKind, conclusion: 'failure', runUrl: null })] }
    const result = detectNewlyFailedRuns(snapshot, new Map(), { now: NOW })
    expect(result[0].runId).toBeNull()
  })

  test('treats missing run id as a transition (defensive — better to fire than miss)', () => {
    // Both previous and current have no parseable run id.
    const snapshot = { repos: [buildRepo({ name: 'a', status: 'failure' as RepoStatusKind, conclusion: 'failure', runUrl: null })] }
    const previous = new Map<string, PreviousRunState>([
      ['org/a', { repoFullName: 'org/a', lastConclusion: 'failure', lastRunId: null, lastNotifiedAt: null }],
    ])
    const result = detectNewlyFailedRuns(snapshot, previous, { now: NOW })
    // Sticky red with no run id to compare → treated as transition.
    expect(result.length).toBe(1)
  })
})

describe('detectNewlyFailedRuns — payload completeness', () => {
  test('carries workflow / commit / run metadata for the notification template', () => {
    const snapshot = {
      repos: [buildRepo({
        name: 'a',
        status: 'failure' as RepoStatusKind,
        conclusion: 'failure',
        workflowName: 'CI / Build',
        commitSha: 'abc1234',
        commitMessage: 'fix: thing',
        commitAuthor: 'Alice',
        runUrl: 'https://github.com/org/a/actions/runs/500',
      })],
    }
    const result = detectNewlyFailedRuns(snapshot, new Map(), { now: NOW })
    expect(result[0].workflowName).toBe('CI / Build')
    expect(result[0].commitSha).toBe('abc1234')
    expect(result[0].commitMessage).toBe('fix: thing')
    expect(result[0].commitAuthor).toBe('Alice')
    expect(result[0].runUrl).toBe('https://github.com/org/a/actions/runs/500')
    expect(result[0].runId).toBe(500)
  })
})
