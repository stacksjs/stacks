import type { BackupInventory } from '../src/host-backup/inventory'
import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { copyFileSync, mkdirSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runHostBackup } from '../src/host-backup/backup'
import { discoverManagedProjects, retireMissingDatabase } from '../src/host-backup/inventory'
import { readJson, saveJson, sqliteSnapshot, withScratch } from '../src/host-backup/io'
import { ResticArchive } from '../src/host-backup/restic'

test('discovers databases in shared storage and retains the history of retired selections', async () => {
  await withScratch(join(tmpdir(), 'host-inventory-'), async (root) => {
    const site = join(root, 'example-main')
    const storage = join(site, 'shared/storage/.private')
    mkdirSync(storage, { recursive: true })
    mkdirSync(join(site, '.ts-cloud'))
    writeFileSync(join(site, '.ts-cloud/owner'), 'example\n')
    symlinkSync('shared', join(site, 'current'))
    const database = join(storage, 'live.sqlite')
    writeFileSync(database, '')
    const unrelated = join(root, 'unrelated')
    mkdirSync(unrelated)
    writeFileSync(join(unrelated, 'outside.sqlite'), '')
    symlinkSync(unrelated, join(storage, 'linked-directory'))
    const projects = discoverManagedProjects(root, root)
    expect(projects.example?.sqlite).toEqual([realpathSync(database)])

    const fixture = { postgres: ['fixture'] }
    const inventory: BackupInventory = { repositories: {}, projects: { ...projects, fixture } }
    expect(() => retireMissingDatabase(inventory, 'fixture', new Set(['fixture']))).toThrow('live database')
    inventory.projects.fixture = { ...fixture, files: ['/keep'] }
    expect(() => retireMissingDatabase(inventory, 'fixture', new Set())).toThrow('database-only')
    inventory.projects.fixture = fixture
    retireMissingDatabase(inventory, 'fixture', new Set())
    expect(inventory.projects.fixture).toBeUndefined()
    expect(inventory.projects.example).toEqual(projects.example)
    expect(inventory.retired_databases?.[0]?.specification).toEqual(fixture)
  })
})

test.skipIf(!Bun.which('restic') || !Bun.which('sqlite3'))('backs up and restores SQLite from two independent Restic repositories', async () => {
  await withScratch(join(tmpdir(), 'host-restic-'), async (root) => {
    const source = join(root, 'source.sqlite')
    const state = join(root, 'status.json')
    using db = new Database(source)
    db.run('PRAGMA journal_mode = WAL')
    db.run('CREATE TABLE messages (body TEXT)')
    db.run("INSERT INTO messages VALUES ('durable')")

    const repositories: Record<string, string> = {}
    for (const provider of ['first', 'second']) {
      const config = join(root, `${provider}.env`)
      writeFileSync(config, `RESTIC_REPOSITORY=${join(root, provider)}\nRESTIC_PASSWORD=fixture-only\n`, { mode: 0o600 })
      await new ResticArchive(config, provider).run('init')
      repositories[provider] = config
    }
    await runHostBackup({ repositories, projects: { fixture: { sqlite: [source] } }, staging: join(root, 'stage') }, state, { preserveBackups: true })
    expect(readJson<{ projects: Record<string, Record<string, { restore_verified: boolean }>> }>(state).projects.fixture).toMatchObject({
      first: { restore_verified: true },
      second: { restore_verified: true },
    })
    const archive = new ResticArchive(repositories.first!, 'first')
    const [snapshot] = await archive.snapshots('--tag', 'app-daily,project:fixture')
    const target = join(root, 'verified.sqlite')
    await archive.restoreVerifiedFile(snapshot!.id, join(root, 'stage/fixture/databases/0-source.sqlite'), target)
    using recovered = new Database(target, { readonly: true })
    expect(recovered.query('SELECT body FROM messages').get()).toEqual({ body: 'durable' })
  })
}, 60_000)

test.skipIf(!Bun.which('sqlite3'))('snapshots committed WAL data without modifying the live database', async () => {
  await withScratch(join(tmpdir(), 'host-sqlite-'), async (root) => {
    const source = join(root, 'source.sqlite')
    const target = join(root, 'snapshot.sqlite')
    using db = new Database(source)
    db.run('PRAGMA journal_mode = WAL')
    db.run('CREATE TABLE messages (body TEXT)')
    db.run("INSERT INTO messages VALUES ('committed')")
    await sqliteSnapshot(source, target)
    using recovered = new Database(target, { readonly: true })
    expect(recovered.query('SELECT body FROM messages').get()).toEqual({ body: 'committed' })
    expect(readdirSync(root).filter(name => name.startsWith('.sqlite-'))).toEqual([])
  })
})

test('retry backs up missing, stale and failed groups and verifies each provider without pruning', async () => {
  await withScratch(join(tmpdir(), 'host-retry-'), async (root) => {
    const state = join(root, 'state.json')
    const now = Math.floor(Date.now() / 1000)
    const fresh = { restore_verified: true, timestamp: now, snapshot: 'old-id', databases: 0 }
    const stale = { ...fresh, timestamp: now - 37 * 3600 }
    saveJson(state, { projects: {
      ready: { aws: fresh, hetzner: fresh },
      stale: { aws: fresh, hetzner: stale },
      partial: { aws: fresh },
      unverified: { aws: fresh, hetzner: { ...fresh, restore_verified: false } },
      failed: { aws: fresh, hetzner: fresh, error: 'failed' },
    } })
    const inventory: BackupInventory = {
      repositories: { aws: 'unused', hetzner: 'unused' },
      projects: { ready: {}, stale: {}, partial: {}, unverified: {}, failed: {}, new: {} },
      staging: join(root, 'stage'),
    }
    const calls: string[][] = []
    const archive = {
      async run(...args: string[]) {
        calls.push(args)
        return '{"message_type":"summary","snapshot_id":"new-id"}'
      },
      async restore(_snapshot: string, path: string, to: string) {
        copyFileSync(path, to)
      },
      async restoreVerifiedFile(_snapshot: string, path: string, to: string) {
        copyFileSync(path, to)
      },
      async snapshots() {
        return []
      },
    }
    const archives = { aws: archive, hetzner: archive }
    let cleared = 0
    const options = { retryFailed: true, preserveBackups: true, onRecovered: async () => { cleared += 1 } }
    await runHostBackup(inventory, state, options, archives)
    expect(calls.map(args => [args[0], args[7]])).toEqual(
      ['stale', 'partial', 'unverified', 'failed', 'new'].flatMap(project => [['backup', `project:${project}`], ['backup', `project:${project}`]]),
    )
    const status = readJson<{ projects: Record<string, { hetzner: typeof fresh }> }>(state)
    expect(status.projects.ready?.hetzner.snapshot).toBe('old-id')
    expect(status.projects.failed?.hetzner.snapshot).toBe('new-id')

    await runHostBackup(inventory, state, options, archives)
    expect(calls).toHaveLength(10)
    expect(cleared).toBe(1)
  })
})
