/**
 * Turso / libSQL (stacksjs/stacks#977).
 *
 * Turso is SQLite's SQL behind a network server, so the framework treats it as
 * the `sqlite` dialect everywhere SQL or DDL is rendered and only the
 * connection differs - bun-query-builder's libSQL transport, chosen by the URL.
 * The first block pins that mapping. The second runs the framework's own `db`
 * against a real libSQL server: `TURSO_TEST_URL` (with `TURSO_TEST_AUTH_TOKEN`
 * if it needs one), or a `sqld` on PATH, which it starts itself.
 */

import type { Subprocess } from 'bun'
import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { findCapability } from '@stacksjs/config'
import { dialectCapabilities, isKnownDialect, isLibsqlDriver, normalizeDatabaseDriver, toQueryBuilderDialect, toSqlIntrospectionDialect } from '../src/dialect'
import { getConnectionString, validateDriverConfig } from '../src/driver-config'
import { resolveMigrationDirectory } from '../src/migration-path'

describe('turso is sqlite over the network', () => {
  test('renders, introspects and migrates as sqlite', () => {
    const caps = dialectCapabilities('turso')
    expect(caps.wire).toBe('sqlite')
    expect(caps.queryBuilderDialect).toBe('sqlite')
    expect(caps.supportsForeignKeys).toBe(true)
    expect(toQueryBuilderDialect('turso')).toBe('sqlite')
    expect(toSqlIntrospectionDialect('turso')).toBe('sqlite')
    expect(isKnownDialect('turso')).toBe(true)
  })

  test('accepts libsql as an alias', () => {
    expect(normalizeDatabaseDriver('libsql')).toBe('turso')
    expect(isLibsqlDriver('libsql')).toBe(true)
    expect(isLibsqlDriver('turso')).toBe(true)
    expect(isLibsqlDriver('sqlite')).toBe(false)
    expect(dialectCapabilities('libsql').dialect).toBe('turso')
    expect(findCapability('database', 'libsql')?.name).toBe('turso')
  })

  test('shares the sqlite migration corpus', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'stacks-turso-corpus-'))
    try {
      expect(resolveMigrationDirectory('turso', { cwd })).toBe(resolveMigrationDirectory('sqlite', { cwd }))
      expect(resolveMigrationDirectory('libsql', { cwd })).toBe(resolveMigrationDirectory('sqlite', { cwd }))
    }
    finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  test('connects by URL, and keeps the token out of it', () => {
    expect(getConnectionString('turso', { url: 'libsql://app-org.turso.io', authToken: 'secret' })).toBe('libsql://app-org.turso.io')
    expect(validateDriverConfig('turso', { url: 'libsql://app-org.turso.io' }).valid).toBe(true)
    expect(validateDriverConfig('turso', { url: '' }).errors[0]).toContain('TURSO_DATABASE_URL')
    expect(validateDriverConfig('turso', { url: 'database/stacks.sqlite' }).valid).toBe(false)
  })
})

let liveUrl = process.env.TURSO_TEST_URL ?? ''
let sqld: Subprocess | null = null
let sqldDir = ''

async function startSqld(): Promise<string> {
  const bin = Bun.which('sqld')
  if (!bin)
    return ''
  sqldDir = mkdtempSync(join(tmpdir(), 'stacks-sqld-'))
  const port = 21000 + Math.floor(Math.random() * 20000)
  sqld = Bun.spawn([bin, '--http-listen-addr', `127.0.0.1:${port}`, '--db-path', join(sqldDir, 'data.sqld'), '--no-welcome'], { stdout: 'ignore', stderr: 'ignore' })
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok)
        return `http://127.0.0.1:${port}`
    }
    catch {}
    await Bun.sleep(50)
  }
  return ''
}

afterAll(() => {
  sqld?.kill()
  if (sqldDir)
    rmSync(sqldDir, { recursive: true, force: true })
})

describe('turso against a live libSQL server', () => {
  test('CRUD, rollback, parallel writes and the migration lock through the framework db', async () => {
    if (!liveUrl)
      liveUrl = await startSqld()
    if (!liveUrl) {
      console.warn('[turso.test] no TURSO_TEST_URL and no sqld on PATH - live check skipped')
      return
    }

    const child = Bun.spawn([process.execPath, join(import.meta.dir, 'fixtures/turso-roundtrip.ts')], {
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'turso', TURSO_DATABASE_URL: liveUrl, TURSO_AUTH_TOKEN: process.env.TURSO_TEST_AUTH_TOKEN ?? '' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 50_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('turso roundtrip ok')
    }
    finally {
      clearTimeout(watchdog)
      child.kill()
    }
  }, 60_000)
})
