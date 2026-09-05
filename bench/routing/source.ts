/** Git state before a benchmark creates its output files or starts a server. */
export interface SourceState {
  revision: string | null
  dirty: boolean | null
}

async function git(cwd: string, args: string[]): Promise<string | null> {
  try {
    const proc = Bun.spawn(['git', '-C', cwd, ...args], { stdout: 'pipe', stderr: 'ignore' })
    const [output, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
    return code === 0 ? output.trim() : null
  }
  catch {
    return null
  }
}

export async function readSourceState(cwd: string): Promise<SourceState> {
  const revision = await git(cwd, ['rev-parse', '--verify', 'HEAD'])
  if (!revision || !/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(revision))
    return { revision: null, dirty: null }
  const status = await git(cwd, ['status', '--porcelain', '--untracked-files=normal'])
  return { revision, dirty: status === null ? null : status.length > 0 }
}

export function formatSourceState(source?: SourceState): string {
  if (!source?.revision) return 'unavailable'
  const state = source.dirty === true ? 'modified working tree' : source.dirty === false ? 'clean working tree' : 'working tree state unavailable'
  return `\`${source.revision}\` (${state})`
}
