import { readFile, readdir } from 'node:fs/promises'
import { platform } from 'node:os'

const HOST_PLATFORM = platform()

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

export function parseProcChildren(contents: string): number[] {
  return contents.trim().split(/\s+/).flatMap((value) => {
    const pid = Number(value)
    return Number.isSafeInteger(pid) && pid > 0 ? [pid] : []
  })
}

async function procChildren(pid: number, procRoot: string): Promise<number[]> {
  try {
    const taskIds = await readdir(`${procRoot}/${pid}/task`)
    const childLists = await Promise.all(taskIds.map(async (taskId) => {
      try {
        return parseProcChildren(await readFile(`${procRoot}/${pid}/task/${taskId}/children`, 'utf8'))
      }
      catch {
        return []
      }
    }))
    return [...new Set(childLists.flat())]
  }
  catch {
    return []
  }
}

/** Read one Linux process tree without spawning a sampler process. */
export async function residentProcTreeBytes(rootPid: number, procRoot = '/proc'): Promise<number | null> {
  let total = 0
  const pending = [rootPid]
  const seen = new Set<number>()
  while (pending.length > 0) {
    const pid = pending.pop()!
    if (seen.has(pid)) continue
    seen.add(pid)
    let rss: number | null = null
    try {
      rss = parseProcStatusRss(await readFile(`${procRoot}/${pid}/status`, 'utf8'))
    }
    catch {
      if (pid === rootPid) return null
    }
    if (rss == null) {
      if (pid === rootPid) return null
      continue
    }
    total += rss
    pending.push(...await procChildren(pid, procRoot))
  }
  return total
}

/** Read the resident set size of one process without including the load generator. */
export async function residentBytes(pid: number): Promise<number | null> {
  if (HOST_PLATFORM === 'linux') {
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
  if (HOST_PLATFORM === 'linux') {
    const total = await residentProcTreeBytes(pid)
    if (total != null) return total
  }

  const proc = Bun.spawn(['ps', '-axo', 'pid=,ppid=,rss='], {
    stdout: 'pipe',
    stderr: 'ignore',
  })
  const stdout = await new Response(proc.stdout).text()
  if (await proc.exited !== 0) return null
  return parsePsProcessTreeRss(stdout, pid)
}
