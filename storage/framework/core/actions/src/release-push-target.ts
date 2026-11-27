import { execFileSync } from 'node:child_process'
import process from 'node:process'

interface ReleasePushTarget { remote: string, ref: string }

/** Resolve the configured upstream and required source-CI branch before release writes. */
export function releasePushTarget(cwd = process.cwd(), requiredBranch?: string): ReleasePushTarget {
  const git = (args: string[], optional = false): string => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    }
    catch (error) {
      if (optional && error instanceof Error && 'status' in error && error.status === 1)
        return ''
      throw new Error('Cannot resolve the release branch and remote. Release requires a valid Git checkout on a branch.')
    }
  }
  const branch = git(['symbolic-ref', '--short', 'HEAD'])
  const remote = git(['config', '--get-all', `branch.${branch}.remote`], true)
  const ref = git(['config', '--get-all', `branch.${branch}.merge`], true)
  if (Boolean(remote) !== Boolean(ref))
    throw new Error('The release branch has an incomplete upstream configuration.')
  const target = { remote: remote || 'origin', ref: ref || `refs/heads/${branch}` }
  if (target.remote === '.' || !git(['remote']).split('\n').includes(target.remote))
    throw new Error('The release destination must name a configured remote.')
  if (!target.ref.startsWith('refs/heads/') || target.ref.includes('\n'))
    throw new Error('The release upstream must be a single branch.')
  git(['check-ref-format', target.ref])
  if (requiredBranch && target.ref !== `refs/heads/${requiredBranch}`)
    throw new Error(`Release requires upstream branch refs/heads/${requiredBranch}; configure this branch to track ${target.remote}/${requiredBranch} before releasing.`)
  return target
}

/** Read the remote directly: a local tracking ref can lag or change from another worktree. */
export function readReleaseRefs(cwd: string, target: ReleasePushTarget, version: string) {
  const tagRef = `refs/tags/v${version}`
  let output: string
  try {
    output = execFileSync('git', ['ls-remote', '--refs', '--', target.remote, target.ref, tagRef], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    }).trim()
  }
  catch { throw new Error(`Could not read release refs from ${target.remote}`) }
  const refs = new Map(output.split('\n').map(line => {
    const [commit, ref] = line.split('\t')
    return [ref, commit] as const
  }))
  return { branch: refs.get(target.ref), tag: refs.get(tagRef), tagRef }
}

export function assertReleaseAvailable(cwd: string, target: ReleasePushTarget, version: string): void {
  const refs = readReleaseRefs(cwd, target, version)
  if (refs.tag) throw new Error(`${refs.tagRef} already exists on ${target.remote} at ${refs.tag}`)
  const gitOptions = { cwd, encoding: 'utf8' as const, stdio: 'pipe' as const }
  let localTag: string | undefined
  try { localTag = execFileSync('git', ['rev-parse', '--verify', '--quiet', refs.tagRef], gitOptions).trim() }
  catch (error) {
    if (!(error instanceof Error) || !('status' in error) || error.status !== 1) throw error
  }
  if (localTag) throw new Error(`${refs.tagRef} already exists locally at ${localTag}`)
  if (refs.branch) {
    try { execFileSync('git', ['merge-base', '--is-ancestor', refs.branch, 'HEAD'], gitOptions) }
    catch { throw new Error(`${target.remote}/${target.ref} is at ${refs.branch}, ahead of or unrelated to this checkout. Integrate it before releasing.`) }
  }
}
