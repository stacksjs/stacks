import { createHash } from 'node:crypto'
import { readFileSync, readlinkSync } from 'node:fs'
import { hostname } from 'node:os'
import process from 'node:process'

/** A Linux process incarnation, not a PID that can be reused after exit. */
export interface ProcessLeaseOwner {
  host: string
  boot: string
  namespace: string
  pid: number
  birth: string
}

function machine(): { host: string, boot: string, namespace: string } | undefined {
  if (process.platform !== 'linux') return
  try {
    const id = readFileSync('/etc/machine-id', 'utf8').trim()
    const boot = readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()
    const namespace = readlinkSync('/proc/self/ns/pid')
    if (!id || !boot) return
    return { host: createHash('sha256').update(`${hostname()}\0${id}`).digest('hex'), boot, namespace }
  }
  catch { return undefined }
}

function birth(pid: number): string {
  const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
  // comm can contain spaces and parentheses; field 22 follows its last ')'.
  const value = stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/)[19]
  if (!value || !/^\d+$/.test(value)) throw new Error('Process birth identity unavailable')
  return value
}

/** Unsupported hosts fail closed and continue using the ordinary lease TTL. */
export function captureProcessLeaseOwner(pid = process.pid): ProcessLeaseOwner | undefined {
  if (!Number.isSafeInteger(pid) || pid < 1) return
  const local = machine()
  if (!local) return
  try { return { ...local, pid, birth: birth(pid) } }
  catch { return undefined }
}

/** Only a positively dead local incarnation may be reclaimed before its TTL. */
export function processLeaseOwnerStatus(value: unknown): 'alive' | 'dead' | 'unknown' {
  if (!value || typeof value !== 'object') return 'unknown'
  const owner = value as Partial<ProcessLeaseOwner>
  if (typeof owner.host !== 'string' || typeof owner.boot !== 'string' || typeof owner.birth !== 'string'
    || typeof owner.namespace !== 'string' || !/^pid:\[\d+\]$/.test(owner.namespace)
    || !/^\d+$/.test(owner.birth) || !Number.isSafeInteger(owner.pid) || Number(owner.pid) < 1) return 'unknown'
  const local = machine()
  if (!local || local.host !== owner.host) return 'unknown'
  if (local.boot !== owner.boot) return 'dead'
  if (local.namespace !== owner.namespace) return 'unknown'
  try { return birth(owner.pid!) === owner.birth ? 'alive' : 'dead' }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'dead' : 'unknown' }
}
