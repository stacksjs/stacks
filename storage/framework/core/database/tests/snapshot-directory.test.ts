import { afterEach, describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import process from 'node:process'
import { resolveSnapshotDirectory, snapshotDirectoryIsShared, snapshotDirForQueryBuilder } from '../src/migration-path'

const ORIGINAL = process.env.DB_SNAPSHOT_PATH

afterEach(() => {
  if (ORIGINAL === undefined)
    delete process.env.DB_SNAPSHOT_PATH
  else
    process.env.DB_SNAPSHOT_PATH = ORIGINAL
})

// stacksjs/stacks#2351 — the model snapshot is the migration baseline. When it
// lives inside the release directory a Capistrano-style deploy never sees one,
// so the differ re-derives from scratch and proposes the same change forever.
describe('snapshot directory resolution', () => {
  const cwd = '/srv/app/releases/abc123'

  it('defaults to the in-project path', () => {
    delete process.env.DB_SNAPSHOT_PATH
    expect(resolveSnapshotDirectory(cwd)).toBe(join(cwd, 'storage/framework/database'))
    expect(snapshotDirectoryIsShared()).toBe(false)
  })

  it('resolves a relative override against the project root', () => {
    process.env.DB_SNAPSHOT_PATH = '../../shared/db'
    expect(resolveSnapshotDirectory(cwd)).toBe('/srv/app/shared/db')
    expect(snapshotDirectoryIsShared()).toBe(true)
  })

  it('honours an absolute override instead of nesting it under the release', () => {
    process.env.DB_SNAPSHOT_PATH = '/srv/app/shared/db'
    expect(resolveSnapshotDirectory(cwd)).toBe('/srv/app/shared/db')
    // The bug this guards: join(cwd, '/srv/app/shared/db') would be
    // '/srv/app/releases/abc123/srv/app/shared/db', back inside the release.
    expect(resolveSnapshotDirectory(cwd).startsWith(cwd)).toBe(false)
  })

  // bun-query-builder resolves its own snapshotDir as join(workspaceRoot, value),
  // and join ignores nothing about an absolute second segment. Handing it an
  // absolute path writes back inside the release, so the value it receives must
  // be relative and must round-trip to the directory the operator asked for.
  it('hands the query builder a value its own join resolves back to the same directory', () => {
    for (const configured of ['/srv/app/shared/db', '../../shared/db', 'storage/framework/database']) {
      process.env.DB_SNAPSHOT_PATH = configured
      const forQb = snapshotDirForQueryBuilder(cwd)
      expect(forQb.startsWith('/')).toBe(false)
      expect(join(cwd, forQb)).toBe(resolveSnapshotDirectory(cwd))
    }
  })

  it('never returns an empty string for the query builder', () => {
    process.env.DB_SNAPSHOT_PATH = cwd
    expect(snapshotDirForQueryBuilder(cwd)).toBe('.')
    expect(join(cwd, snapshotDirForQueryBuilder(cwd))).toBe(cwd)
  })
})
