import { execFileSync } from 'node:child_process'
import process from 'node:process'

/** Resolve the configured upstream before a release mutates manifests or creates a tag. */
export function releasePushTarget(cwd = process.cwd()): { remote: string, ref: string } {
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
  return target
}
