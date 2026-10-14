/**
 * A GitHub release for a tag a release just pushed.
 *
 * `buddy release` (for an app) and `buddy release:ios` tagged, committed and
 * pushed, and stopped there: hq.training had 29 tags and no releases, so there
 * was no changelog for a build and nothing to link a TestFlight report to. The
 * framework's own release gets one from CI (release.yml); an app has no such
 * workflow, so the command that cut the tag now creates the release itself.
 *
 * The notes are logsmith's, the same generator that writes CHANGELOG.md, over
 * the commits since the previous tag. The token is the one the push just used
 * where that can be found: GITHUB_TOKEN or GH_TOKEN, the GitHub CLI's, or the
 * git credential for github.com.
 *
 * Creating the release never fails the release. The tag is already pushed by
 * then, so a missing token or an API error is reported with the command that
 * finishes the job (`buddy release:github <tag>`), which is also idempotent:
 * a tag that already has a release is left as it is.
 */

import process from 'node:process'

export const GITHUB_API_URL = 'https://api.github.com'

/** GitHub's limit on a release body is 125,000 characters; stay clear of it. */
export const MAX_RELEASE_BODY = 120_000

export interface GitHubRepository {
  owner: string
  repo: string
}

export interface GitHubReleaseDraft {
  tag: string
  name: string
  body: string
  prerelease?: boolean
}

export interface GitHubReleaseResult {
  status: 'created' | 'exists' | 'skipped' | 'failed'
  url?: string
  reason?: string
}

type RunCommand = (cmd: string[], input?: string) => { exitCode: number, stdout: string }

function runCommand(cmd: string[], input?: string): { exitCode: number, stdout: string } {
  try {
    const result = Bun.spawnSync(cmd, {
      stdin: input === undefined ? 'ignore' : Buffer.from(input),
      stdout: 'pipe',
      stderr: 'ignore',
      // A credential lookup must never stop a release to ask for a password.
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' },
    })
    return { exitCode: result.exitCode ?? 1, stdout: result.stdout?.toString() ?? '' }
  }
  catch {
    // The command is not installed.
    return { exitCode: 127, stdout: '' }
  }
}

/** The GitHub repository a remote URL points at, or null for any other host. */
export function parseGitHubRemote(url: string | undefined): GitHubRepository | null {
  const match = url?.trim().match(/^(?:https?:\/\/(?:[^@/]+@)?github\.com\/|(?:ssh:\/\/)?git@github\.com[:/])([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/)
  if (!match)
    return null
  return { owner: match[1]!, repo: match[2]! }
}

/**
 * A token that can create releases: the environment's, then the GitHub CLI's,
 * then the git credential the push itself used.
 */
export function resolveGitHubToken(env: Record<string, string | undefined> = process.env, run: RunCommand = runCommand): string | null {
  for (const key of ['GITHUB_TOKEN', 'GH_TOKEN']) {
    const value = env[key]?.trim()
    if (value)
      return value
  }

  const gh = run(['gh', 'auth', 'token', '--hostname', 'github.com'])
  if (gh.exitCode === 0 && gh.stdout.trim())
    return gh.stdout.trim()

  const credential = run(['git', 'credential', 'fill'], 'protocol=https\nhost=github.com\n\n')
  if (credential.exitCode === 0) {
    const password = credential.stdout.split('\n').find(line => line.startsWith('password='))?.slice('password='.length).trim()
    if (password)
      return password
  }

  return null
}

/** The body cut to GitHub's limit, pointing at the full comparison when cut. */
export function fitReleaseBody(body: string, compareUrl?: string): string {
  if (body.length <= MAX_RELEASE_BODY)
    return body
  const note = `\n\n…the notes were longer than GitHub allows${compareUrl ? `; see [every change](${compareUrl})` : ''}.\n`
  const cut = body.slice(0, MAX_RELEASE_BODY - note.length)
  return `${cut.slice(0, Math.max(0, cut.lastIndexOf('\n')))}${note}`
}

export interface CreateGitHubReleaseOptions {
  token: string
  apiUrl?: string
  fetch?: typeof globalThis.fetch
}

/**
 * Create the release for `draft.tag`, unless that tag already has one.
 * Throws on an API error; {@link publishGitHubRelease} turns that into a warning.
 */
export async function createGitHubRelease(
  repository: GitHubRepository,
  draft: GitHubReleaseDraft,
  options: CreateGitHubReleaseOptions,
): Promise<{ url: string, created: boolean }> {
  const fetcher = options.fetch ?? globalThis.fetch
  const base = `${(options.apiUrl ?? GITHUB_API_URL).replace(/\/$/, '')}/repos/${repository.owner}/${repository.repo}/releases`
  const headers = {
    'Authorization': `Bearer ${options.token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const existing = await fetcher(`${base}/tags/${encodeURIComponent(draft.tag)}`, { headers })
  if (existing.ok)
    return { url: ((await existing.json()) as { html_url: string }).html_url, created: false }
  if (existing.status !== 404)
    throw new Error(`GitHub API ${existing.status} looking up the release for ${draft.tag}: ${await apiMessage(existing)}`)

  const response = await fetcher(base, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: draft.tag,
      name: draft.name,
      body: draft.body,
      draft: false,
      prerelease: draft.prerelease ?? false,
    }),
  })
  if (!response.ok)
    throw new Error(`GitHub API ${response.status} creating the release for ${draft.tag}: ${await apiMessage(response)}`)
  return { url: ((await response.json()) as { html_url: string }).html_url, created: true }
}

async function apiMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  try {
    return (JSON.parse(text) as { message?: string }).message || text || response.statusText
  }
  catch {
    return text || response.statusText
  }
}

function git(cwd: string, args: string[]): string | null {
  const result = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'ignore' })
  return result.exitCode === 0 ? result.stdout.toString().trim() : null
}

/** The tag before `tag` in its history, or undefined for the first release. */
export function previousTag(cwd: string, tag: string): string | undefined {
  return git(cwd, ['describe', '--tags', '--abbrev=0', `${tag}^`]) || undefined
}

/** The newest tag at or before `ref`, or undefined when there is none. */
export function latestTag(cwd: string, ref = 'HEAD'): string | undefined {
  return git(cwd, ['describe', '--tags', '--abbrev=0', ref]) || undefined
}

/** The GitHub repository `origin` points at, or null. */
export function originRepository(cwd: string): GitHubRepository | null {
  return parseGitHubRemote(git(cwd, ['remote', 'get-url', 'origin']) ?? undefined)
}

/** The commits between the previous tag and `tag`, as logsmith renders them. */
export async function releaseNotes(options: { cwd: string, tag: string, from?: string, repository: GitHubRepository }): Promise<string> {
  const { generateChangelog, loadLogsmithConfig } = await import('@stacksjs/logsmith')
  const repoUrl = `https://github.com/${options.repository.owner}/${options.repository.repo}`
  const config = await loadLogsmithConfig({
    dir: options.cwd,
    from: options.from,
    to: options.tag,
    output: false,
    theme: 'github',
    // Commit and issue links have to point at this repository, not whatever
    // the logsmith config found first, and a public page carries no emails.
    repo: repoUrl,
    hideAuthorEmail: true,
  })
  const content = (await generateChangelog(config)).content.trim()
  return content || `No changes since ${options.from ?? 'the start of the history'}.`
}

export interface PublishGitHubReleaseOptions {
  cwd: string
  tag: string
  /** The release title; the tag when omitted. */
  name?: string
  /** Markdown above the changelog, e.g. which TestFlight build the tag became. */
  summary?: string
  prerelease?: boolean
  /**
   * The commit a tag that does not exist yet will point at (a dry run's
   * `HEAD`). The notes then run from the newest tag at or before it.
   */
  ref?: string
  /** Print what would be created and create nothing. */
  dryRun?: boolean
  env?: Record<string, string | undefined>
  fetch?: typeof globalThis.fetch
  run?: RunCommand
}

/**
 * Create the GitHub release for a pushed tag, with the changes since the tag
 * before it. Never throws: the result says what happened and why.
 */
export async function publishGitHubRelease(options: PublishGitHubReleaseOptions): Promise<GitHubReleaseResult & { draft?: GitHubReleaseDraft }> {
  const repository = originRepository(options.cwd)
  if (!repository)
    return { status: 'skipped', reason: 'origin is not a GitHub repository' }

  try {
    const from = options.ref ? latestTag(options.cwd, options.ref) : previousTag(options.cwd, options.tag)
    const notes = await releaseNotes({ cwd: options.cwd, tag: options.ref ?? options.tag, from, repository })
    const compareUrl = from ? `https://github.com/${repository.owner}/${repository.repo}/compare/${from}...${options.tag}` : undefined
    const draft: GitHubReleaseDraft = {
      tag: options.tag,
      name: options.name ?? options.tag,
      body: fitReleaseBody(options.summary ? `${options.summary.trim()}\n\n${notes}` : notes, compareUrl),
      prerelease: options.prerelease,
    }
    if (options.dryRun)
      return { status: 'skipped', reason: 'dry run', draft }

    const token = resolveGitHubToken(options.env, options.run)
    if (!token)
      return { status: 'failed', reason: 'no GitHub token (set GITHUB_TOKEN, or sign in with `gh auth login`)', draft }

    const release = await createGitHubRelease(repository, draft, { token, fetch: options.fetch })
    return { status: release.created ? 'created' : 'exists', url: release.url, draft }
  }
  catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) }
  }
}

/** One line for the release log, with the retry command when it failed. */
export function describeGitHubRelease(tag: string, result: GitHubReleaseResult): string {
  switch (result.status) {
    case 'created':
      return `Created the GitHub release ${result.url}`
    case 'exists':
      return `${tag} already has a GitHub release: ${result.url}`
    case 'skipped':
      return `No GitHub release for ${tag}: ${result.reason}`
    case 'failed':
      return `Could not create the GitHub release for ${tag} (${result.reason}). The tag is pushed; run \`buddy release:github ${tag}\` to finish it.`
  }
}
