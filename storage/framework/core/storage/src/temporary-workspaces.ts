import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'

export interface TemporaryWorkspaceRecord {
  id: string
  key: string
  path: string
  inode: string
  device: string
  uid: string
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
    // A bind mount may expose the workspace under a different name in another process's namespace.
    return [fields[3], fields[4]].some(field => field && beneath(field.replace(/\\([0-7]{3})/g, (_match, octal) => String.fromCharCode(Number.parseInt(octal, 8))), path))
  })
}

/** Fail closed when mounts or process references cannot be inspected. Never terminates a process. */
export function temporaryWorkspaceIsUnused(path: string): boolean {
  try {
    if (process.platform === 'linux') {
      if (mountedWorkspace(readFileSync('/proc/self/mountinfo', 'utf8'), path)) return false
      const uid = process.getuid?.()
      for (const pid of readdirSync('/proc').filter(name => /^\d+$/.test(name))) {
        const directory = `/proc/${pid}`
        try {
          // An ordinary runner can inspect its own jobs. Root also checks other users.
          if (uid !== 0 && statSync(directory).uid !== uid) continue
          if (mountedWorkspace(readFileSync(`${directory}/mountinfo`, 'utf8'), path)) return false
          const references = [readlinkSync(`${directory}/cwd`), readlinkSync(`${directory}/exe`)]
          for (const fd of readdirSync(`${directory}/fd`)) {
            try { references.push(readlinkSync(`${directory}/fd/${fd}`)) }
            catch (error) { if (!vanished(error)) throw error }
          }
          for (const line of readFileSync(`${directory}/maps`, 'utf8').split('\n')) {
            const mapped = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$/.exec(line)?.[1]
            if (mapped) references.push(mapped)
          }
          if (references.some(reference => beneath(reference, path))) return false
        }
        catch (error) { if (!vanished(error)) return false }
      }
      return true
    }
    if (process.platform === 'darwin') {
      const mounts = Bun.spawnSync(['mount'], { stdout: 'pipe', stderr: 'pipe' })
      if (mounts.exitCode !== 0) return false
      for (const line of mounts.stdout.toString().split('\n')) {
        const mount = / on (.+) \(/.exec(line)?.[1]
        if (mount && beneath(mount, path)) return false
      }
      const uid = process.getuid?.()
      if (uid === undefined) return false
      const args = ['lsof', '-nP', '-F0n', ...(uid === 0 ? [] : ['-u', String(uid)])]
      const files = Bun.spawnSync(args, { stdout: 'pipe', stderr: 'pipe' })
      if (files.exitCode !== 0 || files.stderr.length > 0) return false
      return !files.stdout.toString().split('\0').some(field => field.startsWith('n') && beneath(field.slice(1), path))
    }
  }
  catch { return false }
  return false
}

/**
 * Recoverable temporary directories, journaled outside untrusted workspace contents.
 * The caller supplies authoritative lifecycle permission; age alone never permits deletion.
 */
export class TemporaryWorkspaceJournal {
  readonly directory: string
  readonly temporaryRoot: string
  readonly prefix: string

  constructor(options: { directory: string, temporaryRoot: string, prefix: string }) {
    if (typeof options.prefix !== 'string' || !/^[a-z0-9_-]+$/i.test(options.prefix)) throw new TypeError('Invalid temporary workspace prefix')
    mkdirSync(options.directory, { recursive: true, mode: 0o700 })
    const journal = lstatSync(options.directory)
    if (!journal.isDirectory() || journal.isSymbolicLink() || journal.uid !== process.getuid?.() || (journal.mode & 0o077) !== 0)
      throw new Error('A workspace journal must be a private directory owned by this user')
    this.directory = realpathSync(options.directory)
    this.temporaryRoot = realpathSync(options.temporaryRoot)
    if (this.directory === this.temporaryRoot)
      throw new Error('The journal cannot be the temporary root')
    this.prefix = options.prefix
  }

  create(key: string): TemporaryWorkspaceRecord {
    if (typeof key !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(key)) throw new TypeError('Invalid workspace key')
    const path = mkdtempSync(join(this.temporaryRoot, `${this.prefix}${key}-`))
    const identity = lstatSync(path, { bigint: true })
    const record = { id: crypto.randomUUID(), key, path, inode: String(identity.ino), device: String(identity.dev), uid: String(identity.uid) }
    const file = join(this.directory, `${record.id}.json`)
    try {
      writeFileSync(`${file}.tmp`, JSON.stringify(record), { flag: 'wx', mode: 0o600 })
      renameSync(`${file}.tmp`, file)
      return record
    }
    catch (error) {
      rmSync(path, { recursive: true, force: true })
      rmSync(`${file}.tmp`, { force: true })
      throw error
    }
  }

  list(): TemporaryWorkspaceRecord[] {
    const records: TemporaryWorkspaceRecord[] = []
    for (const entry of readdirSync(this.directory).slice(0, 1000)) {
      if (!entry.endsWith('.json')) continue
      const record = this.read(entry.slice(0, -5))
      if (record) records.push(record)
    }
    return records
  }

  async retire(id: string, mayRetire: (record: TemporaryWorkspaceRecord) => boolean | Promise<boolean>): Promise<boolean> {
    const record = this.read(id)
    if (!record || await mayRetire(record) !== true) return false
    try {
      const identity = lstatSync(record.path, { bigint: true })
      if (!identity.isDirectory() || identity.isSymbolicLink() || String(identity.uid) !== record.uid
        || String(identity.uid) !== String(process.getuid?.()) || String(identity.ino) !== record.inode || String(identity.dev) !== record.device)
        return false
      if (!temporaryWorkspaceIsUnused(record.path)) return false
      // Inspect identity again after the asynchronous authorization and process check.
      const current = lstatSync(record.path, { bigint: true })
      if (current.ino !== identity.ino || current.dev !== identity.dev || current.isSymbolicLink()) return false
      rmSync(record.path, { recursive: true })
    }
    catch (error) { if (!vanished(error) || existsSync(record.path)) return false }
    rmSync(join(this.directory, `${record.id}.json`), { force: true })
    return true
  }

  private read(id: string): TemporaryWorkspaceRecord | null {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return null
    try {
      const file = join(this.directory, `${id}.json`)
      const identity = lstatSync(file)
      if (!identity.isFile() || identity.isSymbolicLink() || identity.uid !== process.getuid?.() || (identity.mode & 0o077) !== 0 || identity.size > 4096) return null
      const value = JSON.parse(readFileSync(file, 'utf8'))
      if (!value || value.id !== id || typeof value.key !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(value.key)
        || typeof value.path !== 'string' || resolve(value.path) !== value.path || dirname(value.path) !== this.temporaryRoot
        || !basename(value.path).startsWith(`${this.prefix}${value.key}-`)
        || !['inode', 'device', 'uid'].every(key => typeof value[key] === 'string' && /^\d+$/.test(value[key]))) return null
      return value
    }
    catch { return null }
  }
}
