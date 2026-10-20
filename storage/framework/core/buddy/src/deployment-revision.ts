import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
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
 * checkout cannot simply enumerate the difference: a newer merge can expose
 * shared ancestors hidden behind the CI boundary, making an older live release
 * look newer even when CI is a proven ancestor. It used to `--unshallow` for
 * that, and on a large repository (hq.training: a 277 MiB pack, ~2,600
 * commits) that outran its 60-second limit on the runner, so every deploy that
 * raced a push failed and production stopped updating (2026-10-20). Full
 * history is not what the question needs. `rev-list <ci>..<tip>` is exact once
 * CI is an ancestor of the tip and every shallow boundary the tip reaches is a
 * proper ancestor of CI: nothing that came after CI can hide below a boundary
 * CI already descends from, and CI's own parents are present to exclude the
 * history it shares with a merged side branch. So the branch is deepened in
 * steps (64, 512, 4096 commits) until that holds, and only a history that
 * still does not satisfy it falls back to `--unshallow`, with a far longer
 * limit. Depth cuts can still hide a path from CI to an older commit a merge
 * reaches more directly; that only lists the older commit as newer, which
 * refuses a deploy rather than shipping backwards.
 */
export async function assertCurrentDeploymentRevision(revision: AutomatedDeploymentRevision | undefined, cwd = process.cwd()): Promise<DeploymentRevisionCheck | undefined> {
  if (!revision)
    return undefined
  const git = async (operation: string, args: string[], options: { allowFailure?: boolean, timeoutSeconds?: number } = {}): Promise<string | null> => {
    const timeoutSeconds = options.timeoutSeconds ?? 60
    try {
      const result = await execute('git', args, {
        cwd,
        timeout: timeoutSeconds * 1000,
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
      })
      return result.stdout.trim()
    }
    catch (error) {
      if (options.allowFailure)
        return null
      // Only fixed operation names and numeric status are safe to report.
      // Git messages, arguments, stderr and causes can contain credentials.
      let status = 'Git failed to execute'
      if (error instanceof Error) {
        if ('code' in error && error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER')
          status = 'Git exceeded its output limit'
        else if ('killed' in error && error.killed === true)
          status = `Git exceeded its ${timeoutSeconds}-second limit`
        else if ('code' in error && typeof error.code === 'number' && Number.isSafeInteger(error.code) && error.code >= 0)
          status = `Git exited with status ${error.code}`
      }
      throw new Error(`Cannot verify the automated deployment revision against origin while ${operation}: ${status}; production deployment stopped.`)
    }
  }
  // Exit status 1 is the answer "no", not a failure to answer.
  const isAncestor = async (ancestor: string, descendant: string): Promise<boolean> =>
    (await git('checking revision ancestry', ['merge-base', '--is-ancestor', ancestor, descendant], { allowFailure: true })) !== null
  const isShallow = async (): Promise<boolean> =>
    (await git('checking repository history depth', ['rev-parse', '--is-shallow-repository'])) === 'true'
  const fetchedTip = async (): Promise<string> =>
    String(await git('reading the fetched branch head', ['rev-parse', '--verify', 'FETCH_HEAD^{commit}'])).toLowerCase()

  await git('validating the branch ref', ['check-ref-format', revision.ref])
  const checkout = await git('reading the checkout revision', ['rev-parse', '--verify', 'HEAD'])
  if (checkout?.toLowerCase() !== revision.sha)
    throw new Error('The deployment checkout does not match the CI commit; production deployment stopped.')
  const remote = await git('reading the origin branch head', ['ls-remote', '--exit-code', '--refs', 'origin', revision.ref])
  const lines = String(remote).split('\n').map(line => line.split(/\s+/))
  if (lines.length !== 1 || lines[0]?.[1] !== revision.ref || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(lines[0]?.[0] ?? ''))
    throw new Error('Origin did not return one authoritative branch head; production deployment stopped.')
  const head = lines[0]![0]!.toLowerCase()
  if (head === revision.sha)
    return Object.freeze({ revision, newer: [] })

  // Whether the history fetched so far answers the question exactly: CI is
  // on the fetched branch, and every shallow boundary the tip reaches lies
  // strictly below CI.
  const historySuffices = async (tip: string): Promise<boolean> => {
    if (!(await isAncestor(revision.sha, tip)))
      return false
    if (!(await isShallow()))
      return true
    const shallowFile = resolve(cwd, String(await git('locating the shallow boundary list', ['rev-parse', '--git-path', 'shallow'])))
    const boundaries = await readFile(shallowFile, 'utf8').then(
      text => text.split('\n').map(line => line.trim().toLowerCase()).filter(Boolean),
      () => [] as string[],
    )
    for (const boundary of boundaries) {
      if (!(await isAncestor(boundary, tip)))
        continue
      if (boundary === revision.sha || !(await isAncestor(boundary, revision.sha)))
        return false
    }
    return true
  }

  // By ref rather than by SHA, which not every server serves. The branch may
  // have moved again since ls-remote; the fetched tip is then newer still,
  // and the question is the same.
  let tip: string
  if (!(await isShallow())) {
    await git('fetching the origin branch history', ['fetch', '--quiet', '--no-tags', 'origin', revision.ref], { timeoutSeconds: 180 })
    tip = await fetchedTip()
  }
  else {
    let enough = false
    tip = ''
    for (const depth of [64, 512, 4096]) {
      await git('deepening the origin branch history', ['fetch', '--quiet', '--no-tags', `--depth=${depth}`, 'origin', revision.ref], { timeoutSeconds: 180 })
      tip = await fetchedTip()
      if ((enough = await historySuffices(tip)))
        break
      // A complete history that still lacks CI has answered "not on the branch".
      if (!(await isShallow()))
        break
    }
    if (!enough && (await isShallow())) {
      await git('fetching the origin branch history', ['fetch', '--quiet', '--no-tags', '--unshallow', 'origin', revision.ref], { timeoutSeconds: 600 })
      if (await isShallow())
        throw new Error('Cannot verify complete origin history; production deployment stopped.')
      tip = await fetchedTip()
    }
  }
  if (!(await isAncestor(revision.sha, tip)))
    throw new Error('This CI commit is no longer on the origin branch; production deployment stopped. Deploy the current branch head.')
  const newer = String(await git('listing newer branch revisions', ['rev-list', `${revision.sha}..${tip}`])).split('\n').map(line => line.trim().toLowerCase()).filter(Boolean)
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
