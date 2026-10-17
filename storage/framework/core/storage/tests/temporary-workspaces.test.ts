import { afterEach, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TemporaryWorkspaceJournal } from '../src/temporary-workspaces'

const roots: string[] = []
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'stacks-workspace-journal-'))
  roots.push(root)
  const options = { directory: join(root, 'journal'), temporaryRoot: root, prefix: 'job-' }
  return { root, options, journal: new TemporaryWorkspaceJournal(options) }
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

test('a restarted journal recovers and retires an authorized unused workspace', async () => {
  const { journal, options } = fixture()
  const record = journal.create('643')
  writeFileSync(join(record.path, 'output.txt'), 'completed')
  const restarted = new TemporaryWorkspaceJournal(options)
  expect(restarted.list()).toEqual([record])
  expect(await restarted.retire(record.id, row => row.key === '643')).toBe(true)
  expect(existsSync(record.path)).toBe(false)
  expect(restarted.list()).toEqual([])
})

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

test('a live process using the workspace prevents retirement until it exits', async () => {
  const { journal } = fixture()
  const record = journal.create('643')
  const child = Bun.spawn([process.execPath, '-e', 'console.log("ready");setInterval(()=>{},1000)'], { cwd: record.path, stdout: 'pipe', stderr: 'pipe' })
  try {
    await child.stdout.getReader().read()
    expect(await journal.retire(record.id, () => true)).toBe(false)
    expect(existsSync(record.path)).toBe(true)
  }
  finally { child.kill(); await child.exited }
  expect(await journal.retire(record.id, () => true)).toBe(true)
})

test('an open file protects a workspace even when the process works elsewhere', async () => {
  const { journal, root } = fixture()
  const record = journal.create('643')
  const file = join(record.path, 'held.txt')
  writeFileSync(file, 'held')
  const child = Bun.spawn([process.execPath, '-e', 'import {openSync} from "node:fs";openSync(process.argv.at(-1),"r");console.log("ready");setInterval(()=>{},1000)', file], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  try {
    await child.stdout.getReader().read()
    expect(await journal.retire(record.id, () => true)).toBe(false)
  }
  finally { child.kill(); await child.exited }
  expect(await journal.retire(record.id, () => true)).toBe(true)
})
