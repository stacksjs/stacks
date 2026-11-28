import { githubRequest, mapWithConcurrency } from '@stacksjs/github'
import { isProjectRoot, listProjects, registerProject } from '@stacksjs/path'
import { parseGitHubRemote, resolveGitHubToken } from '../github-release'
import { isTrustedTrayRequest, trayOrigins } from './tray-origin'

interface LocalProject {
  id: string
  name: string
  repository: string | null
}

interface GitHubIssue {
  number: number
  title: string
  state: 'open' | 'closed'
  updated_at: string
  labels: Array<string | { name: string }>
  pull_request?: unknown
}

interface DashboardIssue {
  repository: string
  number: number
  title: string
  state: GitHubIssue['state']
  updatedAt: string
  labels: string[]
  url: string
}

interface IssuesSnapshot {
  projects: LocalProject[]
  issues: DashboardIssue[]
  failures: Array<{ repository: string, message: string }>
  loading: boolean
}

interface GitHubIssuesRoutesOptions {
  root: string
  port: number
  url: () => string
  fetch?: typeof fetch
  resolveToken?: () => string | null
}

function projectRepository(root: string): string | null {
  let remotes: ReturnType<typeof Bun.spawnSync>
  try {
    remotes = Bun.spawnSync(['git', 'remote', '-v'], { cwd: root, stdout: 'pipe', stderr: 'ignore', timeout: 2_000 })
  }
  catch {
    return null
  }
  if (remotes.exitCode !== 0 || !remotes.stdout)
    return null

  const repositories = new Map<string, string>()
  for (const line of remotes.stdout.toString().split('\n')) {
    const match = /^(\S+)\s+(\S+)\s+\(fetch\)$/.exec(line)
    if (!match)
      continue
    const repository = parseGitHubRemote(match[2])
    if (repository && ![repository.owner, repository.repo].some(part => part === '.' || part === '..'))
      repositories.set(match[1]!, `${repository.owner}/${repository.repo}`.toLowerCase())
  }
  return repositories.get('origin') ?? repositories.get('upstream') ?? repositories.values().next().value ?? null
}

function localProjects(root: string): LocalProject[] {
  const current = registerProject(root)
  const others = listProjects().filter(project => project.id !== current?.id && isProjectRoot(project.path))
  return (current ? [current, ...others] : others).map(({ id, name, path }) => ({
    id,
    name,
    repository: projectRepository(path),
  }))
}

function issueError(response: Response, authenticated: boolean): string {
  if (response.status === 429 || (response.status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after'))))
    return authenticated ? 'GitHub rate limit reached. Try again later.' : 'GitHub rate limit reached. Sign in with gh auth login or try again later.'
  if (response.status === 401)
    return 'GitHub rejected your credentials. Check your GitHub token or CLI login.'
  if (response.status === 403 || response.status === 404)
    return 'GitHub could not open this repository. Check that your account has access to its issues.'
  if (response.status === 410)
    return 'Issues are disabled for this repository.'
  return `GitHub returned HTTP ${response.status}.`
}

async function loadRepositoryIssues(repository: string, token: string | null, snapshot: IssuesSnapshot, fetcher?: typeof fetch): Promise<void> {
  const seen = new Set<number>()
  try {
    for (let page = 1; ; page++) {
      const response = await githubRequest(
        `/repos/${repository}/issues?state=all&sort=created&per_page=100&page=${page}`,
        {},
        { token: token ?? undefined, anonymous: !token, retry: false, signal: AbortSignal.timeout(12_000), fetch: fetcher },
      )
      if (!response.ok) {
        await response.body?.cancel()
        snapshot.failures.push({ repository, message: issueError(response, Boolean(token)) })
        return
      }
      const pageIssues = await response.json() as GitHubIssue[]
      for (const issue of pageIssues) {
        if (issue.pull_request || seen.has(issue.number) || !Number.isSafeInteger(issue.number) || (issue.state !== 'open' && issue.state !== 'closed'))
          continue
        seen.add(issue.number)
        snapshot.issues.push({
          repository,
          number: issue.number,
          title: issue.title,
          state: issue.state,
          updatedAt: issue.updated_at,
          labels: issue.labels.map(label => typeof label === 'string' ? label : label.name),
          url: `https://github.com/${repository}/issues/${issue.number}`,
        })
      }
      if (!/;\s*rel="next"/.test(response.headers.get('link') ?? ''))
        return
    }
  }
  catch {
    snapshot.failures.push({ repository, message: 'Could not finish loading issues from GitHub.' })
  }
}

function reply(data: object, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      'cache-control': 'private, no-store',
      'cross-origin-resource-policy': 'same-origin',
      'x-content-type-options': 'nosniff',
    },
  })
}

export function dashboardGitHubIssuesRoutes(options: GitHubIssuesRoutesOptions) {
  let current: IssuesSnapshot | undefined
  let finishedAt = 0

  function start(): IssuesSnapshot {
    const projects = localProjects(options.root)
    const repositories = [...new Set(projects.flatMap(project => project.repository ? [project.repository] : []))]
    const token = repositories.length ? (options.resolveToken ?? resolveGitHubToken)() : null
    const snapshot: IssuesSnapshot = { projects, issues: [], failures: [], loading: true }
    // Long histories may take several pages. Let the dashboard show each
    // batch as it arrives, with a single load shared by tabs and refreshes.
    void mapWithConcurrency(repositories, 4, repository => loadRepositoryIssues(repository, token, snapshot, options.fetch)).finally(() => {
      snapshot.loading = false
      finishedAt = Date.now()
    })
    return snapshot
  }

  return {
    '/__buddy/github-issues': async (request: Request): Promise<Response> => {
      if (request.method !== 'GET')
        return reply({ message: 'Method not allowed.' }, 405)
      const url = new URL(request.url)
      const origins = [...trayOrigins(options.port, null), new URL(options.url()).origin]
      const host = request.headers.get('host') ?? url.host
      const site = request.headers.get('sec-fetch-site')
      if (!origins.some(origin => new URL(origin).host === host)
        || (site && site !== 'same-origin')
        || !isTrustedTrayRequest(request, origins))
        return reply({ message: 'Open GitHub Issues from the local Buddy dashboard.' }, 403)

      try {
        // Polling only reads the existing snapshot, even after it has aged.
        if (!current || (!current.loading && url.searchParams.get('poll') !== '1'
          && (url.searchParams.get('refresh') === '1' || Date.now() - finishedAt >= 60_000)))
          current = start()

        return reply({
          ...current,
          issues: [...current.issues].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)
            || a.repository.localeCompare(b.repository) || b.number - a.number),
        })
      }
      catch {
        return reply({ message: 'Buddy could not load GitHub issues for your local projects.' }, 500)
      }
    },
  }
}
