import { describe, expect, test } from 'bun:test'
import { createPullRequestWithFiles, fetchRepositoryFile, fetchRepositoryTree } from '../src/pull-requests'

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('GitHub pull request workflow', () => {
  test('creates a single commit, branch, and draft pull request', async () => {
    const calls: Array<{ url: string, method: string, body: any }> = []
    const responses = [
      json({ default_branch: 'main' }),
      json({ object: { sha: 'base-sha' } }),
      json({ tree: { sha: 'base-tree' } }),
      json({ sha: 'blob-a' }),
      json({ sha: 'blob-b' }),
      json({ sha: 'new-tree' }),
      json({ sha: 'commit-sha' }),
      json({ ref: 'refs/heads/bughq/fix-1' }, 201),
      json({ number: 42, html_url: 'https://github.com/stacksjs/bughq/pull/42' }, 201),
    ]
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      })
      return responses.shift()!
    }) as typeof fetch

    const result = await createPullRequestWithFiles({
      owner: 'stacksjs',
      repo: 'bughq',
      branch: 'bughq/fix-1',
      title: 'fix: prevent crash',
      body: 'AI generated fix',
      commitMessage: 'fix: prevent crash',
      files: [
        { path: 'src/a.ts', content: 'export const a = 1\n' },
        { path: 'src/b.ts', content: 'export const b = 2\n' },
      ],
      token: 'test-token',
      fetch: fetcher,
    })

    expect(result).toEqual({
      number: 42,
      url: 'https://github.com/stacksjs/bughq/pull/42',
      branch: 'bughq/fix-1',
      base: 'main',
      commitSha: 'commit-sha',
    })
    expect(calls.filter(call => call.url.endsWith('/git/blobs'))).toHaveLength(2)
    expect(calls.at(-2)?.body).toEqual({ ref: 'refs/heads/bughq/fix-1', sha: 'commit-sha' })
    expect(calls.at(-1)?.body).toMatchObject({ draft: true, head: 'bughq/fix-1', base: 'main' })
  })

  test('reads repository trees and base64 files', async () => {
    const responses = [
      json({ sha: 'tree', truncated: false, tree: [{ path: 'src/a.ts', mode: '100644', type: 'blob', sha: 'a', size: 12 }] }),
      json({ type: 'file', encoding: 'base64', content: Buffer.from('hello\n').toString('base64'), size: 6 }),
    ]
    const fetcher = (async () => responses.shift()!) as typeof fetch
    const tree = await fetchRepositoryTree('stacksjs', 'bughq', 'main', { token: 'test', fetch: fetcher })
    const file = await fetchRepositoryFile('stacksjs', 'bughq', 'src/a.ts', 'main', { token: 'test', fetch: fetcher })
    expect(tree.entries[0]?.path).toBe('src/a.ts')
    expect(file).toBe('hello\n')
  })

  test('rejects unsafe paths before making a request', async () => {
    await expect(createPullRequestWithFiles({
      owner: 'stacksjs', repo: 'bughq', branch: 'fix', title: 'x', body: 'x', commitMessage: 'x',
      files: [{ path: '../secret', content: 'x' }], token: 'test',
    })).rejects.toThrow('Unsafe repository path')
  })
})
