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

/** Reject obsolete CI releases without changing the checkout or remote. */
export async function assertCurrentDeploymentRevision(revision: AutomatedDeploymentRevision | undefined, cwd = process.cwd()): Promise<void> {
  if (!revision)
    return
  const git = async (args: string[]): Promise<string> => {
    try {
      const result = await execute('git', args, {
        cwd,
        timeout: 15_000,
        maxBuffer: 64 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
      })
      return result.stdout.trim()
    }
    catch {
      // Git diagnostics can contain remote credentials. Never forward them.
      throw new Error('Cannot verify the automated deployment revision against origin; production deployment stopped.')
    }
  }
  await git(['check-ref-format', revision.ref])
  const checkout = await git(['rev-parse', '--verify', 'HEAD'])
  if (checkout.toLowerCase() !== revision.sha)
    throw new Error('The deployment checkout does not match the CI commit; production deployment stopped.')
  const remote = await git(['ls-remote', '--exit-code', '--refs', 'origin', revision.ref])
  const lines = remote.split('\n').map(line => line.split(/\s+/))
  if (lines.length !== 1 || lines[0]?.[1] !== revision.ref || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(lines[0]?.[0] ?? ''))
    throw new Error('Origin did not return one authoritative branch head; production deployment stopped.')
  if (lines[0]?.[0]?.toLowerCase() !== revision.sha)
    throw new Error('This CI commit is no longer the origin branch head; production deployment stopped. Deploy the current branch head.')
}
