import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'

export interface TemporaryWorkspaceRecord {
  readonly id: string
  readonly key: string
  readonly path: string
  readonly inode: string
  readonly device: string
  readonly uid: string
}

export interface TemporaryWorkspaceInspection {
  unused: boolean
  reason: 'unused' | 'mounted' | 'process-reference' | 'inspection-unavailable' | 'unsupported-platform'
  pid?: number
  operation?: string
  code?: string
}

export interface TemporaryWorkspaceRetirementInspection {
  ready: boolean
  reason: 'ready' | 'record-invalid' | 'not-authorized' | 'identity-changed' | TemporaryWorkspaceInspection['reason']
  record?: TemporaryWorkspaceRecord
  usage?: TemporaryWorkspaceInspection
}

function vanished(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ESRCH')
}

function beneath(path: string, root: string): boolean {
  const clean = path.replace(/ \(deleted\)$/, '')
  return clean === root || clean.startsWith(`${root}/`)
}

function mountedWorkspace(table: string, path: string): boolean {
  return table.split('\n').some((line) => {
    const fields = line.split(' ')
    return [fields[3], fields[4]].some(field => field && beneath(field.replace(/\\([0-7]{3})/g, (_match, octal) => String.fromCharCode(Number.parseInt(octal, 8))), path))
  })
}

/** Report missing inspection permission explicitly; never infer that an unreadable process is idle. */
export function inspectTemporaryWorkspace(path: string): TemporaryWorkspaceInspection {
  let operation = 'mounts'
  try {
    if (process.platform === 'linux') {
      if (mountedWorkspace(readFileSync('/proc/self/mountinfo', 'utf8'), path)) return { unused: false, reason: 'mounted' }
      const uid = process.getuid?.()
      for (const pid of readdirSync('/proc').filter(name => /^\d+$/.test(name))) {
        const directory = `/proc/${pid}`
        try {
          operation = 'process-owner'
          // proc directory ownership can change when a process becomes non-dumpable.
          // Its real/effective/saved/filesystem UIDs remain available in status.
          const identities = /^Uid:\s+(.+)$/m.exec(readFileSync(`${directory}/status`, 'utf8'))?.[1]?.trim().split(/\s+/).map(Number)
          if (!identities?.length) return { unused: false, reason: 'inspection-unavailable', pid: Number(pid), operation }
          if (uid !== 0 && !identities.includes(Number(uid))) continue
          operation = 'process-mounts'
          if (mountedWorkspace(readFileSync(`${directory}/mountinfo`, 'utf8'), path)) return { unused: false, reason: 'mounted', pid: Number(pid) }
          operation = 'process-paths'
          const references = [readlinkSync(`${directory}/cwd`), readlinkSync(`${directory}/exe`)]
          operation = 'process-files'
          for (const fd of readdirSync(`${directory}/fd`)) {
            try { references.push(readlinkSync(`${directory}/fd/${fd}`)) }
            catch (error) { if (!vanished(error)) throw error }
          }
          operation = 'process-maps'
          for (const line of readFileSync(`${directory}/maps`, 'utf8').split('\n')) {
            const mapped = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$/.exec(line)?.[1]
            if (mapped) references.push(mapped)
          }
          if (references.some(reference => beneath(reference, path))) return { unused: false, reason: 'process-reference', pid: Number(pid) }
        }
        catch (error) {
          if (!vanished(error)) return { unused: false, reason: 'inspection-unavailable', pid: Number(pid), operation, code: error instanceof Error && 'code' in error ? String(error.code) : undefined }
        }
      }
      return { unused: true, reason: 'unused' }
    }
    if (process.platform === 'darwin') {
      const mounts = Bun.spawnSync(['mount'], { stdout: 'pipe', stderr: 'pipe' })
      if (mounts.exitCode !== 0) return { unused: false, reason: 'inspection-unavailable', operation }
      for (const line of mounts.stdout.toString().split('\n')) {
        const mount = / on (.+) \(/.exec(line)?.[1]
        if (mount && beneath(mount, path)) return { unused: false, reason: 'mounted' }
      }
      const uid = process.getuid?.()
      if (uid === undefined) return { unused: false, reason: 'inspection-unavailable', operation: 'process-owner' }
      operation = 'process-files'
      const files = Bun.spawnSync(['lsof', '-nP', '-F0n', ...(uid === 0 ? [] : ['-u', String(uid)])], { stdout: 'pipe', stderr: 'pipe' })
      if (files.exitCode !== 0 || files.stderr.length > 0) return { unused: false, reason: 'inspection-unavailable', operation }
      const used = files.stdout.toString().split('\0').some(field => field.startsWith('n') && beneath(field.slice(1), path))
      return { unused: !used, reason: used ? 'process-reference' : 'unused' }
    }
  }
  catch (error) { return { unused: false, reason: 'inspection-unavailable', operation, code: error instanceof Error && 'code' in error ? String(error.code) : undefined } }
  return { unused: false, reason: 'unsupported-platform' }
}

export function temporaryWorkspaceIsUnused(path: string): boolean {
  return inspectTemporaryWorkspace(path).unused
}

/** Recoverable directories with separate live ownership and crash-recovery lifecycles. */
export class TemporaryWorkspaceJournal {
  readonly directory: string
  readonly temporaryRoot: string
  readonly prefix: string
  readonly ownerUid: number
  private readonly active = new Map<string, TemporaryWorkspaceRecord>()
  private readonly rootInode: string
  private readonly rootDevice: string
  private readonly journalInode: string
  private readonly journalDevice: string

  constructor(options: { directory: string, temporaryRoot: string, prefix: string, ownerUid?: number }) {
    if (typeof options.prefix !== 'string' || !/^[a-z0-9_-]+$/i.test(options.prefix)) throw new TypeError('Invalid temporary workspace prefix')
    const currentUid = process.getuid?.()
    const ownerUid = options.ownerUid ?? currentUid
    if (currentUid === undefined || ownerUid === undefined || !Number.isSafeInteger(ownerUid) || ownerUid < 0) throw new Error('Workspace ownership requires a POSIX user identity')
    if (ownerUid !== currentUid && currentUid !== 0) throw new Error('Only root may maintain another user\'s workspace journal')
    if (ownerUid !== currentUid && !existsSync(options.directory)) throw new Error('Another user\'s journal must already exist')
    mkdirSync(options.directory, { recursive: true, mode: 0o700 })
    const journal = lstatSync(options.directory)
    if (!journal.isDirectory() || journal.isSymbolicLink() || journal.uid !== ownerUid || (journal.mode & 0o077) !== 0)
      throw new Error('A workspace journal must be a private directory owned by its declared user')
    this.ownerUid = ownerUid
    this.directory = realpathSync(options.directory)
    this.temporaryRoot = realpathSync(options.temporaryRoot)
    if (this.directory === this.temporaryRoot) throw new Error('The journal cannot be the temporary root')
    this.prefix = options.prefix
    const root = lstatSync(this.temporaryRoot, { bigint: true })
    const journalIdentity = lstatSync(this.directory, { bigint: true })
    this.rootInode = String(root.ino)
    this.rootDevice = String(root.dev)
    this.journalInode = String(journalIdentity.ino)
    this.journalDevice = String(journalIdentity.dev)
  }

  create(key: string): TemporaryWorkspaceRecord {
    if (typeof key !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(key)) throw new TypeError('Invalid workspace key')
    if (this.ownerUid !== process.getuid?.()) throw new Error('Maintenance cannot create workspaces for another user')
    if (!this.rootsUnchanged()) throw new Error('The workspace or journal root changed')
    const path = mkdtempSync(join(this.temporaryRoot, `${this.prefix}${key}-`))
    const identity = lstatSync(path, { bigint: true })
    const record: TemporaryWorkspaceRecord = Object.freeze({ id: crypto.randomUUID(), key, path, inode: String(identity.ino), device: String(identity.dev), uid: String(identity.uid) })
    const file = join(this.directory, `${record.id}.json`)
    try {
      writeFileSync(`${file}.tmp`, JSON.stringify(record), { flag: 'wx', mode: 0o600 })
      renameSync(`${file}.tmp`, file)
      this.active.set(record.id, record)
      return record
    }
    catch (error) {
      rmSync(path, { recursive: true, force: true })
      rmSync(`${file}.tmp`, { force: true })
      throw error
    }
  }

  list(): TemporaryWorkspaceRecord[] {
    if (!this.rootsUnchanged()) return []
    const records: TemporaryWorkspaceRecord[] = []
    for (const entry of readdirSync(this.directory).slice(0, 1000)) {
      if (!entry.endsWith('.json')) continue
      const record = this.read(entry.slice(0, -5))
      if (record) records.push(record)
    }
    return records
  }

  /** Dispose a live lease after its owner has stopped its resources. Recovered records cannot use this capability. */
  complete(record: TemporaryWorkspaceRecord): boolean {
    if (!record || this.active.get(record.id) !== record) return false
    if (!this.remove(record)) return false
    this.active.delete(record.id)
    return true
  }

  async retire(id: string, mayRetire: (record: TemporaryWorkspaceRecord) => boolean | Promise<boolean>): Promise<boolean> {
    const verdict = await this.inspectRetirement(id, mayRetire)
    if (!verdict.ready || !verdict.record || !this.remove(verdict.record)) return false
    this.active.delete(verdict.record.id)
    return true
  }

  /** Read-only maintenance preview uses the same authorization and inspection as retirement. */
  async inspectRetirement(id: string, mayRetire: (record: TemporaryWorkspaceRecord) => boolean | Promise<boolean>): Promise<TemporaryWorkspaceRetirementInspection> {
    const record = this.read(id)
    if (!record) return { ready: false, reason: 'record-invalid' }
    if (await mayRetire(record) !== true) return { ready: false, reason: 'not-authorized', record }
    if (!this.rootsUnchanged()) return { ready: false, reason: 'identity-changed', record }
    const identity = this.identity(record)
    if (identity === 'changed' || identity === 'unavailable') return { ready: false, reason: 'identity-changed', record }
    if (identity === 'missing') return { ready: true, reason: 'ready', record }
    const usage = inspectTemporaryWorkspace(record.path)
    return { ready: usage.unused, reason: usage.unused ? 'ready' : usage.reason, record, usage }
  }

  private identity(record: TemporaryWorkspaceRecord): 'same' | 'missing' | 'changed' | 'unavailable' {
    try {
      const identity = lstatSync(record.path, { bigint: true })
      const same = identity.isDirectory() && !identity.isSymbolicLink() && String(identity.uid) === record.uid
        && String(identity.uid) === String(this.ownerUid) && String(identity.ino) === record.inode && String(identity.dev) === record.device
      return same ? 'same' : 'changed'
    }
    catch (error) { return vanished(error) ? 'missing' : 'unavailable' }
  }

  private remove(record: TemporaryWorkspaceRecord): boolean {
    try {
      if (!this.rootsUnchanged()) return false
      const identity = this.identity(record)
      if (identity === 'changed' || identity === 'unavailable') return false
      if (identity === 'same') rmSync(record.path, { recursive: true })
    }
    catch (error) { if (!vanished(error) || this.identity(record) !== 'missing') return false }
    rmSync(join(this.directory, `${record.id}.json`), { force: true })
    return true
  }

  private read(id: string): TemporaryWorkspaceRecord | null {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return null
    if (!this.rootsUnchanged()) return null
    try {
      const file = join(this.directory, `${id}.json`)
      const identity = lstatSync(file)
      if (!identity.isFile() || identity.isSymbolicLink() || identity.uid !== this.ownerUid || (identity.mode & 0o077) !== 0 || identity.size > 4096) return null
      const value = JSON.parse(readFileSync(file, 'utf8'))
      if (!value || value.id !== id || typeof value.key !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(value.key)
        || typeof value.path !== 'string' || resolve(value.path) !== value.path || dirname(value.path) !== this.temporaryRoot
        || !basename(value.path).startsWith(`${this.prefix}${value.key}-`)
        || !['inode', 'device', 'uid'].every(key => typeof value[key] === 'string' && /^\d+$/.test(value[key]))) return null
      return Object.freeze(value)
    }
    catch { return null }
  }

  private rootsUnchanged(): boolean {
    try {
      const root = lstatSync(this.temporaryRoot, { bigint: true })
      const journal = lstatSync(this.directory, { bigint: true })
      return root.isDirectory() && !root.isSymbolicLink() && String(root.ino) === this.rootInode && String(root.dev) === this.rootDevice
        && journal.isDirectory() && !journal.isSymbolicLink() && String(journal.ino) === this.journalInode && String(journal.dev) === this.journalDevice
        && String(journal.uid) === String(this.ownerUid) && (journal.mode & 0o077n) === 0n
    }
    catch { return false }
  }
}
