import type { Repo } from './types'
import { ghFetch, GITHUB_API } from './client'

/**
 * Fetch all non-archived public repos across `orgs`, filtering out any names
 * in `ignore` (defaults to `.github` which exists in every org and never has
 * project CI on it).
 */
export async function fetchAllRepos(orgs: string[], ignore: string[] = ['.github']): Promise<Repo[]> {
  const ignored = new Set(ignore)
  const all: Repo[] = []

  for (const org of orgs) {
    let page = 1
    while (true) {
      const res = await ghFetch(`${GITHUB_API}/orgs/${org}/repos?per_page=100&page=${page}&type=public`)
      if (!res.ok)
        break

      const repos = await res.json() as Array<{
        name: string
        owner: { login: string }
        full_name: string
        html_url: string
        default_branch: string
        archived: boolean
      }>
      if (repos.length === 0)
        break

      for (const repo of repos) {
        all.push({
          name: repo.name,
          owner: repo.owner.login,
          full_name: repo.full_name,
          html_url: repo.html_url,
          default_branch: repo.default_branch,
          archived: repo.archived,
        })
      }

      page++
    }
  }

  return all.filter(r => !r.archived && !ignored.has(r.name))
}
