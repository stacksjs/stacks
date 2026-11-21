import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { closeSync, createReadStream, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, statfsSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { parseEnv } from 'node:util'

export const GiB = 1024 ** 3

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function atomicWrite(path: string, content: string | Uint8Array, mode = 0o600): void {
  const scratch = mkdtempSync(join(dirname(path), '.write-'))
  const temporary = join(scratch, 'file')
  try {
    const descriptor = openSync(temporary, 'wx', mode)
    try {
      writeFileSync(descriptor, content)
      fsyncSync(descriptor)
    }
    finally {
      closeSync(descriptor)
    }
    renameSync(temporary, path)
  }
  finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

export function saveJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function envValues(path: string): Record<string, string | undefined> {
  return parseEnv(readFileSync(path, 'utf8'))
}

export function requirePrivateDirectory(path: string): void {
  const stats = lstatSync(path)
  if (!stats.isDirectory() || stats.uid !== process.geteuid?.() || (stats.mode & 0o077))
    throw new Error('Staging must be a dedicated private directory owned by the operator')
}

export function freeBytes(path: string): number {
  const stats = statfsSync(path)
  return stats.bavail * stats.bsize
}

export async function digest(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path))
    hash.update(chunk)
  return hash.digest('hex')
}

export async function withScratch<T>(prefix: string, operation: (path: string) => Promise<T>): Promise<T> {
  const path = mkdtempSync(prefix)
  try {
    return await operation(path)
  }
  finally {
    rmSync(path, { recursive: true, force: true })
  }
}

interface CommandOptions {
  input?: string
  output?: string
  discardOutput?: boolean
  timeoutMs?: number
  env?: Record<string, string | undefined>
}

export async function command(args: string[], options: CommandOptions = {}): Promise<string> {
  const output = options.output ? openSync(options.output, 'w', 0o600) : undefined
  try {
    const child = Bun.spawn(args, {
      stdin: options.input ? Bun.file(options.input) : 'ignore',
      stdout: output ?? (options.discardOutput ? 'ignore' : 'pipe'),
      stderr: 'ignore',
      env: options.env,
      timeout: options.timeoutMs ?? 1_200_000,
      killSignal: 'SIGKILL',
    })
    const [stdout, code] = await Promise.all([
      child.stdout && typeof child.stdout !== 'number' ? new Response(child.stdout).text() : '',
      child.exited,
    ])
    if (code !== 0 || child.signalCode)
      throw new Error(`${basename(args[0] ?? 'command')} failed (${child.signalCode || `exit ${code}`})`)
    return stdout
  }
  finally {
    if (output !== undefined)
      closeSync(output)
  }
}

export async function atomicDump(target: string, args: string[], validate?: (file: string) => Promise<unknown>): Promise<void> {
  await withScratch(join(dirname(target), '.dump-'), async (scratch) => {
    const partial = join(scratch, basename(target))
    const limit = freeBytes(scratch) - 2 * GiB
    if (limit <= 0)
      throw new Error('Insufficient free space for dump')
    // runuser resets RLIMIT_FSIZE. Apply the limit after switching users.
    const position = args[0] === 'runuser' ? args.indexOf('--') + 1 : 0
    const bounded = [...args.slice(0, position), 'prlimit', `--fsize=${limit}:${limit}`, '--', ...args.slice(position)]
    await command(bounded, { output: partial })
    if (Bun.file(partial).size === 0)
      throw new Error('Empty database dump')
    await validate?.(partial)
    renameSync(partial, target)
  })
}

export function validateSqlite(path: string): void {
  using db = new Database(path, { readonly: true })
  const result = db.query<{ quick_check: string }, []>('PRAGMA quick_check').all()
  if (result.length !== 1 || result[0]?.quick_check !== 'ok')
    throw new Error('SQLite recovery integrity check failed')
  db.query('SELECT count(*) FROM sqlite_schema').get()
}

export async function sqliteSnapshot(source: string, target: string): Promise<void> {
  await withScratch(join(dirname(target), '.sqlite-'), async (scratch) => {
    const partial = join(scratch, basename(target))
    // SQLite's online backup includes committed WAL pages. Use a child deadline
    // because a busy database can keep the online backup retrying.
    await command(['sqlite3', '-readonly', '-cmd', '.timeout 30000', source, `.backup "${partial.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`], { timeoutMs: 600_000 })
    // The archive contains a single database file. Leaving the copied header
    // in WAL mode would make some read-only SQLite readers require sidecars.
    await command(['sqlite3', partial, 'PRAGMA journal_mode = DELETE'])
    validateSqlite(partial)
    renameSync(partial, target)
  })
}

export function requireRoot(): void {
  if (process.geteuid?.() !== 0)
    throw new Error('Root is required')
}
