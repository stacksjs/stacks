import { readFile } from 'node:fs/promises'
import { platform } from 'node:os'

export function parseProcStatusRss(contents: string): number | null {
  const match = contents.match(/^VmRSS:\s+(\d+)\s+kB$/m)
  return match ? Number(match[1]) * 1024 : null
}

export function parsePsRss(contents: string): number | null {
  const kilobytes = Number(contents.trim())
  return Number.isFinite(kilobytes) && kilobytes > 0 ? kilobytes * 1024 : null
}

/** Read the resident set size of one process without including the load generator. */
export async function residentBytes(pid: number): Promise<number | null> {
  if (platform() === 'linux') {
    try {
      return parseProcStatusRss(await readFile(`/proc/${pid}/status`, 'utf8'))
    }
    catch { /* fall through to ps */ }
  }

  const proc = Bun.spawn(['ps', '-o', 'rss=', '-p', String(pid)], {
    stdout: 'pipe',
    stderr: 'ignore',
  })
  const stdout = await new Response(proc.stdout).text()
  if (await proc.exited !== 0) return null
  return parsePsRss(stdout)
}
