import { afterEach, describe, expect, test } from 'bun:test'
import { fetchBotPRCounts, fetchPullRequestCounts } from '../src/bots'

const originalFetch = globalThis.fetch
const originalToken = process.env.GITHUB_TOKEN

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalToken === undefined)
    delete process.env.GITHUB_TOKEN
  else
    process.env.GITHUB_TOKEN = originalToken
})

function stubSearch(requests: string[]): void {
  process.env.GITHUB_TOKEN = 'test-token'
  globalThis.fetch = (async (input: string | URL | Request) => {
    requests.push(String(input))
    return new Response(JSON.stringify({
      items: [
        { repository_url: 'https://api.github.com/repos/stacksjs/stacks' },
        { repository_url: 'https://api.github.com/repos/stacksjs/stacks' },
        { repository_url: 'https://api.github.com/repos/stacksjs/stx' },
      ],
      total_count: 3,
    }), { status: 200 })
  }) as typeof globalThis.fetch
}

describe('pull request counts', () => {
  test('counts qualifier matches per repository', async () => {
    const requests: string[] = []
    stubSearch(requests)

    const counts = await fetchPullRequestCounts('stacksjs', 'head:buddy-bot')

    expect(counts.get('stacksjs/stacks')).toBe(2)
    expect(counts.get('stacksjs/stx')).toBe(1)
    expect(decodeURIComponent(requests[0]!)).toContain('is:pr is:open org:stacksjs head:buddy-bot')
  })

  test('keeps the GitHub App helper as a compatibility wrapper', async () => {
    const requests: string[] = []
    stubSearch(requests)

    await fetchBotPRCounts('stacksjs', 'github-actions')

    expect(decodeURIComponent(requests[0]!)).toContain('author:app/github-actions')
  })
})
