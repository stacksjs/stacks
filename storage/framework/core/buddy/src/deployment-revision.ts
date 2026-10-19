import { execFile } from 'node:child_process'
import process from 'node:process'
import { promisify } from 'node:util'

const execute = promisify(execFile)

export interface AutomatedDeploymentRevision {
  ref: string
  sha: string
}

/** Capture provider metadata before loading application environment files. */
export function automatedDeploymentRevision(environment: string, variables: NodeJS.ProcessEnv = process.env): AutomatedDeploymentRevision | undefined {
  if (environment !== 'production')
    return undefined
  const prefix = variables.REVIEWOS === 'true' ? 'REVIEWOS' : variables.GITHUB_ACTIONS === 'true' ? 'GITHUB' : undefined
  if (!prefix)
    return undefined
  const ref = variables[`${prefix}_REF`]
  const sha = variables[`${prefix}_SHA`]
  if (!ref?.startsWith('refs/heads/') || !sha || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(sha))
    throw new Error('Automated production deployment requires a branch ref and full commit SHA from the CI provider.')
  return Object.freeze({ ref, sha: sha.toLowerCase() })
}

/**
 * What a CI deployment learned about its place on the branch: the commits that
 * landed on it after this one (full SHAs, newest first). Empty when the CI
 * commit is the branch head.
 */
export interface DeploymentRevisionCheck {
  revision: AutomatedDeploymentRevision
  newer: string[]
}

/**
 * Reject a CI release that is not on its branch any more, without changing
 * the checkout or the remote.
 *
 * It used to demand that the CI commit still *be* the branch head. With
 * several people (or sessions) pushing faster than CI and the deploy take,
 * every run's head had moved on by the time it reached the deploy, so every
 * deploy was refused and production stopped moving altogether (HQ sat on one
 * release all day, 2026-10-18). What the check is for is never shipping
 * something older than what is live; a verified commit newer than production
 * is forward progress even when an even newer one is still in CI. So this
 * half only proves the commit is on the branch (an ancestor of the head
 * `origin` reports, which rules out a force-pushed-away commit), and returns
 * the commits after it. `assertNotBehindLiveRelease` then refuses only when
 * production already runs one of those.
 *
 * The branch is fetched without updating any ref (FETCH_HEAD only). A shallow
 * checkout must complete its history before enumerating the difference: a
 * newer merge can expose shared ancestors hidden behind the CI boundary,
 * making an older live release look newer even when CI is a proven ancestor.
 */
export async function assertCurrentDeploymentRevision(revision: AutomatedDeploymentRevision | undefined, cwd = process.cwd()): Promise<DeploymentRevisionCheck | undefined> {
  if (!revision)
    return undefined
  const git = async (args: string[], options: { allowFailure?: boolean } = {}): Promise<string | null> => {
    try {
      const result = await execute('git', args, {
        cwd,
        timeout: 60_000,
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
      })
      return result.stdout.trim()
    }
    catch {
      if (options.allowFailure)
        return null
      // Git diagnostics can contain remote credentials. Never forward them.
      throw new Error('Cannot verify the automated deployment revision against origin; production deployment stopped.')
    }
  }
  await git(['check-ref-format', revision.ref])
  const checkout = await git(['rev-parse', '--verify', 'HEAD'])
  if (checkout?.toLowerCase() !== revision.sha)
    throw new Error('The deployment checkout does not match the CI commit; production deployment stopped.')
  const remote = await git(['ls-remote', '--exit-code', '--refs', 'origin', revision.ref])
  const lines = String(remote).split('\n').map(line => line.split(/\s+/))
  if (lines.length !== 1 || lines[0]?.[1] !== revision.ref || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(lines[0]?.[0] ?? ''))
    throw new Error('Origin did not return one authoritative branch head; production deployment stopped.')
  const head = lines[0]![0]!.toLowerCase()
  if (head === revision.sha)
    return Object.freeze({ revision, newer: [] })

  // By ref rather than by SHA, which not every server serves. The branch may
  // have moved again since ls-remote; the fetched tip is then newer still,
  // and the question is the same.
  const shallow = (await git(['rev-parse', '--is-shallow-repository'])) === 'true'
  await git(['fetch', '--quiet', '--no-tags', ...(shallow ? ['--unshallow'] : []), 'origin', revision.ref])
  if ((await git(['rev-parse', '--is-shallow-repository'])) === 'true')
    throw new Error('Cannot verify complete origin history; production deployment stopped.')
  const tip = String(await git(['rev-parse', '--verify', 'FETCH_HEAD^{commit}'])).toLowerCase()
  // Exit status 1 is the answer "no", not a failure to answer.
  const onBranch = (await git(['merge-base', '--is-ancestor', revision.sha, tip], { allowFailure: true })) !== null
  if (!onBranch)
    throw new Error('This CI commit is no longer on the origin branch; production deployment stopped. Deploy the current branch head.')
  const newer = String(await git(['rev-list', `${revision.sha}..${tip}`])).split('\n').map(line => line.trim().toLowerCase()).filter(Boolean)
  return Object.freeze({ revision, newer })
}

/**
 * The second half: refuse only when production already runs a commit that
 * landed after this one, which is what shipping it would roll back.
 *
 * `liveReleases` are the release ids the box serves (`current`'s target under
 * each site, a short or full commit SHA). One that is this commit is a
 * redeploy; one that is older than it, or not on the branch at all (a manual
 * hotfix), is replaced, as any deploy replaces it.
 */
export function assertNotBehindLiveRelease(check: DeploymentRevisionCheck | undefined, liveReleases: readonly string[]): void {
  if (!check || check.newer.length === 0)
    return
  for (const raw of liveReleases) {
    const id = String(raw ?? '').trim().toLowerCase()
    if (!/^[a-f0-9]{7,64}$/.test(id))
      continue
    if (check.newer.some(sha => sha.startsWith(id)))
      throw new Error(`Production already runs ${id}, which is newer than this CI commit; production deployment stopped. Deploy the current branch head.`)
  }
}

/** The shell that lists the release each of a project's sites serves (`/var/www/<slug>-<site>/current`). */
export function liveReleasesCommand(slug: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug))
    throw new Error('A project slug is letters, digits and dashes.')
  return `for d in /var/www/${slug}-*/current; do [ -L "$d" ] && basename "$(readlink -f "$d")"; done; true`
}
