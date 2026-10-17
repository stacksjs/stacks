import { afterEach, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { inspectTemporaryWorkspace, TemporaryWorkspaceJournal } from '../src/temporary-workspaces'
import { cleanup, fixture } from './fixtures/workspace-journal'

afterEach(cleanup)

test('active or unknown lifecycle state retains the workspace and its journal', async () => {
  const { journal } = fixture()
  const record = journal.create('active')
  expect(await journal.retire(record.id, () => false)).toBe(false)
  expect(await Reflect.apply(journal.retire, journal, [record.id, () => 'finished'])).toBe(false)
  expect(existsSync(record.path)).toBe(true)
  expect(journal.list()).toEqual([record])
})

test('workspace identities are exact strings and never invoke caller coercion', async () => {
  const { journal, options } = fixture()
  let coerced = false
  const value = { toString: () => { coerced = true; return '643' } }
  expect(() => Reflect.apply(journal.create, journal, [value])).toThrow('workspace key')
  expect(() => Reflect.construct(TemporaryWorkspaceJournal, [{ ...options, prefix: value }])).toThrow('workspace prefix')
  expect(await Reflect.apply(journal.retire, journal, [value, () => true])).toBe(false)
  expect(coerced).toBe(false)
})

test('a replaced directory and a symlink to foreign content are never retired', async () => {
  const { journal, root } = fixture()
  const record = journal.create('643')
  renameSync(record.path, join(root, 'original'))
  mkdirSync(record.path)
  expect(await journal.retire(record.id, () => true)).toBe(false)
  rmSync(record.path, { recursive: true })
  const foreign = join(root, 'foreign')
  mkdirSync(foreign)
  writeFileSync(join(foreign, 'important'), 'preserve')
  symlinkSync(foreign, record.path)
  expect(await journal.retire(record.id, () => true)).toBe(false)
  expect(readFileSync(join(foreign, 'important'), 'utf8')).toBe('preserve')
})

test('a journal record cannot authorize removal outside its temporary root', async () => {
  const { journal, root } = fixture()
  const record = journal.create('643')
  const foreign = join(root, 'foreign')
  mkdirSync(foreign)
  writeFileSync(join(journal.directory, `${record.id}.json`), JSON.stringify({ ...record, path: foreign }), { mode: 0o600 })
  expect(journal.list()).toEqual([])
  expect(await journal.retire(record.id, () => true)).toBe(false)
  expect(existsSync(foreign)).toBe(true)
})

test('private journal ownership and real directory identity are required', () => {
  const { options } = fixture()
  chmodSync(options.directory, 0o755)
  expect(() => new TemporaryWorkspaceJournal(options)).toThrow('private directory')
  chmodSync(options.directory, 0o700)
  renameSync(options.directory, `${options.directory}-original`)
  symlinkSync(`${options.directory}-original`, options.directory)
  expect(() => new TemporaryWorkspaceJournal(options)).toThrow('private directory')
})

test('normal disposal uses a frozen live handle which a restarted journal cannot forge', () => {
  const { journal, options } = fixture()
  const record = journal.create('live')
  expect(Reflect.set(record, 'path', '/elsewhere')).toBe(false)
  const restarted = new TemporaryWorkspaceJournal(options)
  expect(restarted.complete(record)).toBe(false)
  expect(journal.complete({ ...record })).toBe(false)
  expect(journal.complete(record)).toBe(true)
  expect(existsSync(record.path)).toBe(false)
  expect(journal.list()).toEqual([])
})

if (process.platform === 'linux' && process.getuid?.() !== 0) {
  test('unreadable same-user peers are reported and never become deletion permission', async () => {
    const { journal, root } = fixture()
    const record = journal.create('643')
    const code = 'import {dlopen,FFIType} from "bun:ffi"; const c=dlopen("libc.so.6",{prctl:{args:[FFIType.i32,FFIType.u64,FFIType.u64,FFIType.u64,FFIType.u64],returns:FFIType.i32}});if(c.symbols.prctl(4,0,0,0,0)!==0)throw Error("prctl failed");console.log("protected");setInterval(()=>{},1000)'
    const child = Bun.spawn([process.execPath, '-e', code], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    try {
      const ready = await child.stdout.getReader().read()
      expect(new TextDecoder().decode(ready.value)).toContain('protected')
      expect(() => readlinkSync(`/proc/${child.pid}/cwd`)).toThrow()
      const inspection = inspectTemporaryWorkspace(record.path)
      expect(inspection.unused).toBe(false)
      expect(inspection.reason).toBe('inspection-unavailable')
      expect(await journal.retire(record.id, () => true)).toBe(false)
      expect(existsSync(record.path)).toBe(true)
    }
    finally { child.kill(); await child.exited }
    expect(journal.complete(record)).toBe(true)
  })
}
