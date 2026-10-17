// Full recovery inspects every relevant process. Linux CI runs this fixture
// with read permission for protected peers; the ordinary suite separately
// verifies non-root refusal. No process or ownership guard is disabled.
import { afterEach, expect, test } from 'bun:test'
import { chmodSync, copyFileSync, existsSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { TemporaryWorkspaceJournal } from '../src/temporary-workspaces'
import { cleanup, fixture } from '../tests/fixtures/workspace-journal'

afterEach(cleanup)

async function retireUnused(journal: TemporaryWorkspaceJournal, id: string, authorize: (record: { key: string }) => boolean): Promise<void> {
  const inspection = await journal.inspectRetirement(id, authorize)
  expect(inspection.ready, JSON.stringify(inspection)).toBe(true)
  expect(await journal.retire(id, authorize)).toBe(true)
}

test('a restarted journal recovers and retires an authorized unused workspace', async () => {
  const { journal, options } = fixture()
  const record = journal.create('643')
  writeFileSync(join(record.path, 'output.txt'), 'completed')
  const restarted = new TemporaryWorkspaceJournal(options)
  expect(restarted.list()).toEqual([record])
  await retireUnused(restarted, record.id, row => row.key === '643')
  expect(existsSync(record.path)).toBe(false)
  expect(restarted.list()).toEqual([])
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
  await retireUnused(journal, record.id, () => true)
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
  await retireUnused(journal, record.id, () => true)
})

if (process.platform === 'linux') {
  test('privileged maintenance preserves the declared filesystem owner without granting creation rights', async () => {
    // Stage this exact interpreter and source for the lower-privilege fixture;
    // do not loosen permissions on the operator's home or installed toolchain.
    const staging = fixture().root
    chmodSync(staging, 0o755)
    const runtime = join(staging, 'bun')
    const source = join(staging, 'temporary-workspaces.ts')
    copyFileSync(process.execPath, runtime)
    chmodSync(runtime, 0o755)
    copyFileSync(resolve(import.meta.dir, '../src/temporary-workspaces.ts'), source)
    chmodSync(source, 0o644)
    const code = `import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {TemporaryWorkspaceJournal} from ${JSON.stringify(source)};const root=mkdtempSync(join(tmpdir(),'stacks-maintenance-owner-'));const options={directory:join(root,'journal'),temporaryRoot:root,prefix:'job-'};const journal=new TemporaryWorkspaceJournal(options);console.log(JSON.stringify({root,options,record:journal.create('643')}));`
    const child = Bun.spawn(['runuser', '-u', 'nobody', '--', runtime, '-e', code], { cwd: tmpdir(), stdout: 'pipe', stderr: 'pipe' })
    const [status, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(status, err).toBe(0)
    const foreign = JSON.parse(out)
    expect(dirname(foreign.root)).toBe(realpathSync(tmpdir()))
    expect(basename(foreign.root).startsWith('stacks-maintenance-owner-')).toBe(true)
    try {
      const maintenance = new TemporaryWorkspaceJournal({ ...foreign.options, ownerUid: Number(foreign.record.uid) })
      expect(() => maintenance.create('other-user')).toThrow('cannot create')
      await retireUnused(maintenance, foreign.record.id, () => true)
      expect(existsSync(foreign.record.path)).toBe(false)
    }
    finally { rmSync(foreign.root, { recursive: true, force: true }) }
  })
}
