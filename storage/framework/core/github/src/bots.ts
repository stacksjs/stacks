import { ghFetch, GITHUB_API } from './client'

/**
 * Count open PRs authored by a GitHub App across every repo in an org.
 * Returns a map keyed by `owner/repo` so callers can attribute counts back
 * to the right repo card. Used to surface Renovate / GitHub Actions bot
 * traffic in the dashboard.
 */
export async function fetchBotPRCounts(org: string, authorSlug: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  let page = 1

  while (true) {
    const q = `is:pr is:open org:${org} author:app/${authorSlug}`
    const res = await ghFetch(`${GITHUB_API}/search/issues?q=${encodeURIComponent(q)}&per_page=100&page=${page}`)
    if (!res.ok)
      break

    const data = await res.json() as { items: Array<{ repository_url: string }>, total_count: number }
    if (!data.items || data.items.length === 0)
      break

    for (const item of data.items) {
      const fullName = item.repository_url.replace(`${GITHUB_API}/repos/`, '')
      counts.set(fullName, (counts.get(fullName) ?? 0) + 1)
    }

    if (data.items.length < 100)
      break
    page++
  }

  return counts
}
