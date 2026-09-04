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

export function parsePsProcessTreeRss(contents: string, rootPid: number): number | null {
  const rows = contents.split('\n').flatMap((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)$/)
    return match ? [{ pid: Number(match[1]), parentPid: Number(match[2]), rssKiB: Number(match[3]) }] : []
  })
  const byParent = new Map<number, number[]>()
  const rssByPid = new Map<number, number>()
  for (const row of rows) {
    rssByPid.set(row.pid, row.rssKiB)
    const children = byParent.get(row.parentPid) ?? []
    children.push(row.pid)
    byParent.set(row.parentPid, children)
  }
  if (!rssByPid.has(rootPid)) return null

  let totalKiB = 0
  const pending = [rootPid]
  const seen = new Set<number>()
  while (pending.length > 0) {
    const pid = pending.pop()!
    if (seen.has(pid)) continue
    seen.add(pid)
    totalKiB += rssByPid.get(pid) ?? 0
    pending.push(...(byParent.get(pid) ?? []))
  }
  return totalKiB * 1024
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

/** Read the combined RSS of the server launcher and all descendant processes. */
export async function residentTreeBytes(pid: number): Promise<number | null> {
  const proc = Bun.spawn(['ps', '-axo', 'pid=,ppid=,rss='], {
    stdout: 'pipe',
    stderr: 'ignore',
  })
  const stdout = await new Response(proc.stdout).text()
  if (await proc.exited !== 0) return null
  return parsePsProcessTreeRss(stdout, pid)
}
