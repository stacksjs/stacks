/**
 * Unit tests for the drilldown helpers (stacksjs/stacks#1848).
 *
 * Strategy: stub `global.fetch` so we can hand the helpers canned GH
 * JSON payloads and verify the parse/normalise/duration math without
 * hitting the network.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { fetchRunJobs, fetchWorkflowRuns } from '../src/run-history'

const realFetch = globalThis.fetch
const originalToken = process.env.GITHUB_TOKEN

afterEach(() => {
  globalThis.fetch = realFetch
  if (originalToken === undefined)
    delete process.env.GITHUB_TOKEN
  else
    process.env.GITHUB_TOKEN = originalToken
})

beforeEach(() => {
  // ghHeaders() throws when GITHUB_TOKEN isn't set. The helpers go
  // through ghFetch() which calls ghHeaders, so a fake token is
  // enough for the parse-path coverage these tests care about.
  process.env.GITHUB_TOKEN = 'test-token-1848'
})

function mockFetch(handler: (url: string) => { status: number, body: unknown }): void {
  globalThis.fetch = (async (input: any) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    const { status, body } = handler(url)
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
}

describe('fetchWorkflowRuns', () => {
  test('parses run list and exposes the shape the dashboard consumes', async () => {
    mockFetch(() => ({
      status: 200,
      body: {
        workflow_runs: [
          {
            id: 100,
            status: 'completed',
            conclusion: 'success',
            name: 'CI',
            head_branch: 'main',
            head_sha: 'abcdef0123456789',
            head_commit: { message: 'fix(router): close json bug\nlong body', author: { name: 'Alice' } },
            event: 'push',
            html_url: 'https://github.com/x/y/actions/runs/100',
            actor: { login: 'alice' },
            run_started_at: '2026-05-19T10:00:00Z',
            created_at: '2026-05-19T10:00:00Z',
            updated_at: '2026-05-19T10:02:30Z',
          },
        ],
      },
    }))

    const runs = await fetchWorkflowRuns('x', 'y')
    expect(runs.length).toBe(1)
    const r = runs[0]
    expect(r.id).toBe(100)
    expect(r.conclusion).toBe('success')
    expect(r.headShaShort).toBe('abcdef0') // truncated to 7 chars
    // Commit message clipped to first line.
    expect(r.commitMessage).toBe('fix(router): close json bug')
    // Author falls back to actor.login if head_commit.author is null
    // (covered separately below) — here it's set.
    expect(r.commitAuthor).toBe('Alice')
    expect(r.durationMs).toBe(150_000) // 2m30s
  })

  test('caps limit at 100 even if a larger value is requested', async () => {
    let capturedUrl = ''
    mockFetch((url) => {
      capturedUrl = url
      return { status: 200, body: { workflow_runs: [] } }
    })
    await fetchWorkflowRuns('x', 'y', { limit: 9999 })
    expect(capturedUrl).toContain('per_page=100')
  })

  test('passes through branch + event filters', async () => {
    let capturedUrl = ''
    mockFetch((url) => {
      capturedUrl = url
      return { status: 200, body: { workflow_runs: [] } }
    })
    await fetchWorkflowRuns('x', 'y', { limit: 5, branch: 'feature/foo', event: 'pull_request' })
    expect(capturedUrl).toContain('per_page=5')
    expect(capturedUrl).toContain('branch=feature')
    expect(capturedUrl).toContain('event=pull_request')
  })

  test('falls back to actor.login when head_commit.author is null', async () => {
    mockFetch(() => ({
      status: 200,
      body: {
        workflow_runs: [{
          id: 101,
          status: 'completed',
          conclusion: 'success',
          name: 'CI',
          head_branch: 'main',
          head_sha: 'deadbeef',
          head_commit: null, // missing
          event: 'push',
          html_url: 'https://github.com/x/y/actions/runs/101',
          actor: { login: 'bot-bot' },
          run_started_at: '2026-05-19T10:00:00Z',
          created_at: '2026-05-19T10:00:00Z',
          updated_at: '2026-05-19T10:00:30Z',
        }],
      },
    }))
    const runs = await fetchWorkflowRuns('x', 'y')
    expect(runs[0].commitAuthor).toBe('bot-bot')
    expect(runs[0].commitMessage).toBeNull()
  })

  test('returns empty array when GH responds non-OK', async () => {
    mockFetch(() => ({ status: 404, body: { message: 'Not Found' } }))
    const runs = await fetchWorkflowRuns('x', 'y')
    expect(runs).toEqual([])
  })

  test('durationMs is null when timestamps are out of order', async () => {
    mockFetch(() => ({
      status: 200,
      body: {
        workflow_runs: [{
          id: 102, status: 'completed', conclusion: 'success', name: 'CI',
          head_branch: 'main', head_sha: 'abc1234', head_commit: null,
          event: 'push', html_url: '', actor: null,
          run_started_at: '2026-05-19T11:00:00Z',
          created_at: '2026-05-19T11:00:00Z',
          updated_at: '2026-05-19T10:00:00Z', // backwards
        }],
      },
    }))
    const runs = await fetchWorkflowRuns('x', 'y')
    expect(runs[0].durationMs).toBeNull()
  })
})

describe('fetchRunJobs', () => {
  test('parses job + step shape', async () => {
    mockFetch(() => ({
      status: 200,
      body: {
        jobs: [{
          id: 1000,
          name: 'test',
          status: 'completed',
          conclusion: 'failure',
          started_at: '2026-05-19T10:01:00Z',
          completed_at: '2026-05-19T10:03:00Z',
          html_url: 'https://github.com/x/y/actions/runs/100/job/1000',
          steps: [
            { name: 'Setup', status: 'completed', conclusion: 'success', number: 1 },
            { name: 'Test', status: 'completed', conclusion: 'failure', number: 2 },
          ],
        }],
      },
    }))
    const jobs = await fetchRunJobs('x', 'y', 100)
    expect(jobs.length).toBe(1)
    expect(jobs[0].conclusion).toBe('failure')
    expect(jobs[0].durationMs).toBe(120_000) // 2m
    expect(jobs[0].steps.length).toBe(2)
    expect(jobs[0].steps[1].conclusion).toBe('failure')
  })

  test('returns empty array when GH responds non-OK', async () => {
    mockFetch(() => ({ status: 500, body: { message: 'Internal' } }))
    const jobs = await fetchRunJobs('x', 'y', 100)
    expect(jobs).toEqual([])
  })

  test('handles jobs with no steps array gracefully', async () => {
    mockFetch(() => ({
      status: 200,
      body: { jobs: [{
        id: 1, name: 'noop', status: 'completed', conclusion: 'success',
        started_at: null, completed_at: null, html_url: 'x',
        // steps omitted
      }] },
    }))
    const jobs = await fetchRunJobs('x', 'y', 100)
    expect(jobs[0].steps).toEqual([])
    expect(jobs[0].durationMs).toBeNull()
  })
})
