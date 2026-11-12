import { afterEach, expect, spyOn, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { move, rename, StorageRenameRecoveryError } from '../src/move'
import { fs } from '../src/fs'

// The public Result-returning rename and real filesystem are the seam. These
// checks do not establish hardware durability or hostile same-user isolation.
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'stacks-move-replace-'))
  roots.push(root)
  return realpathSync(root)
}

/** Probe actual directory aliasing rather than infer it from the OS name. */
function supportsAlias(name: string, alias: string): boolean {
  const root = fixture()
  mkdirSync(join(root, name))
  return existsSync(join(root, alias))
}

for (const [name, alias] of [['Bundle', 'bundle'], ['Caf\u00e9', 'Cafe\u0301']]) {
  test.skipIf(!supportsAlias(name!, alias!))(`directory ancestor alias ${JSON.stringify(name)} to ${JSON.stringify(alias)} preserves both trees`, async () => {
    const root = fixture(), destination = join(root, name!), source = join(destination, 'candidate')
    mkdirSync(source, { recursive: true })
    writeFileSync(join(destination, 'retained.txt'), 'previous complete bundle')
    writeFileSync(join(source, 'new.txt'), 'new complete bundle')
    const result = await rename(source, join(root, alias!), { overwrite: true })
    expect(result.isErr).toBe(true)
    expect(existsSync(join(destination, 'retained.txt'))).toBe(true)
    expect(readFileSync(join(destination, 'retained.txt'), 'utf8')).toBe('previous complete bundle')
    expect(readFileSync(join(source, 'new.txt'), 'utf8')).toBe('new complete bundle')
    expect(readdirSync(root).map(entry => entry.normalize('NFC'))).toEqual([name!.normalize('NFC')])
  })
}

test('a lock identity read failure retains both payloads and reports the owned lock', async () => {
  const root = fixture(), source = join(root, 'candidate'), destination = join(root, 'bundle')
  mkdirSync(source); mkdirSync(destination)
  writeFileSync(join(source, 'new.txt'), 'new complete bundle')
  writeFileSync(join(destination, 'retained.txt'), 'previous complete bundle')
  const failure = Object.assign(new Error('Injected lock identity EIO'), { code: 'EIO' })
  const native = fs.lstatSync
  let injected = false
  const fault = spyOn(fs, 'lstatSync').mockImplementation((...args) => {
    if (!injected && String(args[0]).includes('/.stacks-rename-')) { injected = true; throw failure }
    return Reflect.apply(native, fs, args)
  })
  try {
    const result = await rename(source, destination, { overwrite: true })
    expect(result.isErr).toBe(true)
    if (!result.isErr) return
    expect(result.error).toBeInstanceOf(StorageRenameRecoveryError)
    const recovery = result.error as StorageRenameRecoveryError
    expect(recovery).toMatchObject({ phase: 'lock', cause: failure, installed: false })
    expect(existsSync(recovery.lock)).toBe(true)
    expect(readFileSync(join(destination, 'retained.txt'), 'utf8')).toBe('previous complete bundle')
    expect(readFileSync(join(source, 'new.txt'), 'utf8')).toBe('new complete bundle')
  }
  finally { fault.mockRestore() }
})

test('overwriting an ancestor of the source fails without deleting either tree', async () => {
  const root = fixture(), destination = join(root, 'bundle'), source = join(destination, 'candidate')
  mkdirSync(source, { recursive: true })
  writeFileSync(join(destination, 'retained.txt'), 'previous complete bundle')
  writeFileSync(join(source, 'new.txt'), 'new complete bundle')
  const result = await rename(source, destination, { overwrite: true })
  expect(result.isErr).toBe(true)
  expect(existsSync(join(destination, 'retained.txt'))).toBe(true)
  expect(readFileSync(join(destination, 'retained.txt'), 'utf8')).toBe('previous complete bundle')
  expect(readFileSync(join(source, 'new.txt'), 'utf8')).toBe('new complete bundle')
})

test('a canonical parent alias cannot hide an overlapping replacement', async () => {
  const root = fixture(), destination = join(root, 'bundle'), source = join(destination, 'candidate')
  mkdirSync(source, { recursive: true })
  writeFileSync(join(destination, 'retained.txt'), 'previous complete bundle')
  writeFileSync(join(source, 'new.txt'), 'new complete bundle')
  symlinkSync(destination, join(root, 'alias'), 'dir')
  const result = await rename(join(root, 'alias/candidate'), destination, { overwrite: true })
  expect(result.isErr).toBe(true)
  expect(readFileSync(join(destination, 'retained.txt'), 'utf8')).toBe('previous complete bundle')
  expect(readFileSync(join(source, 'new.txt'), 'utf8')).toBe('new complete bundle')
})

test('a failed replacement returns the original error and restores the complete destination', async () => {
  const root = fixture(), source = join(root, 'candidate'), destination = join(root, 'bundle')
  mkdirSync(source); mkdirSync(destination)
  writeFileSync(join(source, 'new.txt'), 'new complete bundle')
  writeFileSync(join(destination, 'retained.txt'), 'previous complete bundle')
  const failure = Object.assign(new Error('Injected filesystem installation failure'), { code: 'EIO' })
  const native = fs.renameSync
  const fault = spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    if (String(from) === source && String(to) === destination && !existsSync(destination)) throw failure
    native(from, to)
  })
  try {
    const result = await rename(source, destination, { overwrite: true })
    expect(result.isErr).toBe(true)
    if (result.isErr) expect(result.error).toBe(failure)
    expect(existsSync(join(destination, 'retained.txt'))).toBe(true)
    expect(readFileSync(join(destination, 'retained.txt'), 'utf8')).toBe('previous complete bundle')
    expect(readFileSync(join(source, 'new.txt'), 'utf8')).toBe('new complete bundle')
  }
  finally { fault.mockRestore() }
})

test('successful directory replacement installs the complete new tree without stale entries', async () => {
  const root = fixture(), source = join(root, 'candidate'), destination = join(root, 'bundle')
  mkdirSync(join(source, 'images'), { recursive: true }); mkdirSync(destination)
  writeFileSync(join(source, 'images/new.txt'), 'new complete bundle')
  writeFileSync(join(source, 'provenance.json'), 'new manifest')
  writeFileSync(join(destination, 'stale.txt'), 'old output')
  expect((await rename(source, destination, { overwrite: true })).isOk).toBe(true)
  expect(readFileSync(join(destination, 'images/new.txt'), 'utf8')).toBe('new complete bundle')
  expect(readFileSync(join(destination, 'provenance.json'), 'utf8')).toBe('new manifest')
  expect(existsSync(join(destination, 'stale.txt'))).toBe(false)
  expect(readdirSync(root)).toEqual(['bundle'])
})

test('ordinary file overwrite keeps the destination until the native rename replaces it', async () => {
  const root = fixture(), source = join(root, 'candidate'), destination = join(root, 'output')
  writeFileSync(source, 'new file'); writeFileSync(destination, 'old file')
  const native = fs.renameSync, observed: string[] = []
  const inspect = spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    expect(String(from)).toBe(source); expect(String(to)).toBe(destination)
    observed.push(readFileSync(destination, 'utf8'))
    native(from, to)
  })
  try {
    expect((await rename(source, destination, { overwrite: true })).isOk).toBe(true)
    expect(observed).toEqual(['old file'])
    expect(readFileSync(destination, 'utf8')).toBe('new file')
    expect(readdirSync(root)).toEqual(['output'])
  }
  finally { inspect.mockRestore() }
})

test('an empty directory destination is replaced directly by native rename', async () => {
  const root = fixture(), source = join(root, 'candidate'), destination = join(root, 'bundle')
  mkdirSync(source); mkdirSync(destination)
  writeFileSync(join(source, 'new.txt'), 'new complete bundle')
  const native = fs.renameSync, calls: string[][] = []
  const inspect = spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    calls.push([String(from), String(to)])
    native(from, to)
  })
  try {
    expect((await rename(source, destination, { overwrite: true })).isOk).toBe(true)
    expect(calls).toEqual([[source, destination]])
    expect(readFileSync(join(destination, 'new.txt'), 'utf8')).toBe('new complete bundle')
  }
  finally { inspect.mockRestore() }
})

test('failed rollback preserves the backup and lock and move retains both errors', async () => {
  const root = fixture(), source = join(root, 'candidate'), destination = join(root, 'bundle')
  mkdirSync(source); mkdirSync(destination)
  writeFileSync(join(source, 'new.txt'), 'new complete bundle')
  writeFileSync(join(destination, 'retained.txt'), 'previous complete bundle')
  const installation = Object.assign(new Error('Injected install EIO'), { code: 'EIO' })
  const restoration = Object.assign(new Error('Injected rollback EACCES'), { code: 'EACCES' })
  const native = fs.renameSync
  const fault = spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    if (String(from) === source && String(to) === destination && !existsSync(destination)) throw installation
    if (String(from).endsWith('/previous') && String(to) === destination) throw restoration
    native(from, to)
  })
  try {
    const result = await move(source, destination, { overwrite: true })
    expect(result.isErr).toBe(true)
    if (!result.isErr) return
    expect(result.error).toBeInstanceOf(StorageRenameRecoveryError)
    const recovery = result.error as StorageRenameRecoveryError
    expect(recovery.phase).toBe('rollback')
    expect(recovery.cause).toBe(installation)
    expect(recovery.recoveryError).toBe(restoration)
    expect(recovery.installed).toBe(false)
    expect(readFileSync(join(recovery.backup!, 'retained.txt'), 'utf8')).toBe('previous complete bundle')
    expect(readFileSync(join(source, 'new.txt'), 'utf8')).toBe('new complete bundle')
    expect(existsSync(join(recovery.lock, 'operation.json'))).toBe(true)
    const again = await rename(source, destination, { overwrite: true })
    expect(again.isErr).toBe(true)
    if (again.isErr) expect(again.error).toMatchObject({ phase: 'lock', lock: recovery.lock })
    expect(readFileSync(join(recovery.backup!, 'retained.txt'), 'utf8')).toBe('previous complete bundle')
  }
  finally { fault.mockRestore() }
})

test('cleanup uncertainty preserves the old backup and reports the installed complete destination', async () => {
  const root = fixture(), source = join(root, 'candidate'), destination = join(root, 'bundle')
  mkdirSync(source); mkdirSync(destination)
  writeFileSync(join(source, 'new.txt'), 'new complete bundle')
  writeFileSync(join(destination, 'retained.txt'), 'previous complete bundle')
  const failure = Object.assign(new Error('Injected cleanup EIO'), { code: 'EIO' })
  const native = fs.rmSync
  const fault = spyOn(fs, 'rmSync').mockImplementation((path, options) => {
    if (String(path).endsWith('/previous')) throw failure
    native(path, options)
  })
  try {
    const result = await rename(source, destination, { overwrite: true })
    expect(result.isErr).toBe(true)
    if (!result.isErr) return
    expect(result.error).toBeInstanceOf(StorageRenameRecoveryError)
    const recovery = result.error as StorageRenameRecoveryError
    expect(recovery).toMatchObject({ phase: 'cleanup', installed: true, cause: failure })
    expect(readFileSync(join(destination, 'new.txt'), 'utf8')).toBe('new complete bundle')
    expect(readFileSync(join(recovery.backup!, 'retained.txt'), 'utf8')).toBe('previous complete bundle')
    expect(existsSync(join(recovery.lock, 'operation.json'))).toBe(true)
  }
  finally { fault.mockRestore() }
})

test('a process interruption preserves recovery state and canonical aliases cannot bypass its lock', async () => {
  const root = fixture(), source = join(root, 'candidate'), destination = join(root, 'bundle')
  mkdirSync(source); mkdirSync(destination)
  writeFileSync(join(source, 'new.txt'), 'new complete bundle')
  writeFileSync(join(destination, 'retained.txt'), 'previous complete bundle')
  const child = Bun.spawn([process.execPath, 'test', resolve(import.meta.dir, 'fixtures/rename-interruption.ts')], {
    cwd: resolve(import.meta.dir, '../../../../..'),
    env: { ...process.env, STACKS_RENAME_INTERRUPTION_ROOT: root },
    stdout: 'pipe', stderr: 'pipe', timeout: 10_000,
  })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(code, stdout + stderr).toBe(43)
  expect(stdout).toContain('INTERRUPTED_AFTER_BACKUP')
  expect(existsSync(destination)).toBe(false)
  const lockName = readdirSync(root).find(name => name.startsWith('.stacks-rename-'))!
  const lock = join(root, lockName), journal = JSON.parse(readFileSync(join(lock, 'operation.json'), 'utf8'))
  expect(journal).toMatchObject({ version: 1, source, destination, backup: join(lock, 'previous') })
  expect(readFileSync(join(journal.backup, 'retained.txt'), 'utf8')).toBe('previous complete bundle')
  expect(readFileSync(join(source, 'new.txt'), 'utf8')).toBe('new complete bundle')
  symlinkSync(root, join(root, 'alias'), 'dir')
  const retry = await rename(source, join(root, 'alias/bundle'), { overwrite: true })
  expect(retry.isErr).toBe(true)
  if (retry.isErr) {
    expect(retry.error).toBeInstanceOf(StorageRenameRecoveryError)
    expect(retry.error).toMatchObject({ phase: 'lock', lock })
  }
  expect(readFileSync(join(journal.backup, 'retained.txt'), 'utf8')).toBe('previous complete bundle')
  expect(readFileSync(join(source, 'new.txt'), 'utf8')).toBe('new complete bundle')
}, 20_000)

test('an unrelated destination appearing during an installation failure is never overwritten by rollback', async () => {
  const root = fixture(), source = join(root, 'candidate'), destination = join(root, 'bundle')
  mkdirSync(source); mkdirSync(destination)
  writeFileSync(join(source, 'new.txt'), 'new complete bundle')
  writeFileSync(join(destination, 'retained.txt'), 'previous complete bundle')
  const failure = Object.assign(new Error('Injected install EIO with a changed destination'), { code: 'EIO' })
  const native = fs.renameSync
  const fault = spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    if (String(from) === source && String(to) === destination && !existsSync(destination)) {
      mkdirSync(destination)
      writeFileSync(join(destination, 'unrelated.txt'), 'unrelated entry')
      throw failure
    }
    native(from, to)
  })
  try {
    const result = await rename(source, destination, { overwrite: true })
    expect(result.isErr).toBe(true)
    if (!result.isErr) return
    expect(result.error).toBeInstanceOf(StorageRenameRecoveryError)
    const recovery = result.error as StorageRenameRecoveryError
    expect(recovery).toMatchObject({ phase: 'rollback', cause: failure })
    expect(readFileSync(join(destination, 'unrelated.txt'), 'utf8')).toBe('unrelated entry')
    expect(readFileSync(join(recovery.backup!, 'retained.txt'), 'utf8')).toBe('previous complete bundle')
  }
  finally { fault.mockRestore() }
})
