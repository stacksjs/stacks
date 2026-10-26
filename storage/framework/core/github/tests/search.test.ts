import { expect, test } from 'bun:test'
import { fetchGitHubNotifications, searchGitHubIssues, searchGitHubRepositories } from '../src/search'

test('public search preserves query syntax and never borrows environment credentials', async () => {
  const calls: { url: string, headers: Headers }[] = []
  const options = { anonymous: true, fetch: (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers) })
    return Response.json({ total_count: 0, incomplete_results: false, items: [] })
  }) as typeof fetch }
  await searchGitHubRepositories('org:stacksjs launcher & tools', options)
  await searchGitHubIssues('repo:stacksjs/launchpad is:open', 'pr', options)
  expect(new URL(calls[0]!.url).searchParams.get('q')).toBe('org:stacksjs launcher & tools')
  expect(new URL(calls[1]!.url).searchParams.get('q')).toBe('is:pr repo:stacksjs/launchpad is:open')
  expect(calls.every(call => !call.headers.has('authorization'))).toBe(true)
})

test('notifications send only the supplied account token and surface permission errors', async () => {
  await expect(fetchGitHubNotifications({ token: 'test-account-token', fetch: (async (_url: unknown, init?: RequestInit) => {
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-account-token')
    return Response.json({ message: 'Insufficient notification permissions' }, { status: 401 })
  }) as typeof fetch })).rejects.toThrow('Insufficient notification permissions')
})

test('interactive searches forward cancellation and surface rate limits without delayed retries', async () => {
  const controller = new AbortController()
  let requests = 0
  await expect(searchGitHubRepositories('stacksjs', { anonymous: true, signal: controller.signal, retry: false, fetch: (async (_url: unknown, init?: RequestInit) => {
    requests++
    expect(init?.signal).toBe(controller.signal)
    return Response.json({ message: 'API rate limit exceeded' }, { status: 403, headers: { 'x-ratelimit-remaining': '0', 'retry-after': '30' } })
  }) as typeof fetch })).rejects.toThrow('API rate limit exceeded')
  expect(requests).toBe(1)
})
