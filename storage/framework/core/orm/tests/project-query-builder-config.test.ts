/**
 * `config/qb.ts` tunes the query builder; it does not choose the database.
 *
 * A scaffold leftover `database: 'database/stacks.sqlite'` in an app's qb.ts
 * was applied whole by the route generator after `@stacksjs/database` had
 * resolved the real connection, so every model query in a QA run went to the
 * developer's database instead of the throwaway one in `DB_DATABASE_PATH`,
 * and failed as `no such table: trails`.
 */

import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { connectionConflictWarning, splitProjectQueryBuilderConfig } from '../src/project-query-builder-config'

const active = { dialect: 'sqlite', database: { database: '/tmp/qa.sqlite' } }

describe('splitting config/qb.ts', () => {
  it('keeps the behaviour and refuses the connection', () => {
    const { behaviour, conflicts } = splitProjectQueryBuilderConfig({
      verbose: true,
      dialect: 'sqlite',
      database: { database: 'database/stacks.sqlite' },
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at', defaultOrderColumn: 'created_at' },
      pagination: { defaultPerPage: 25, cursorColumn: 'id' },
    }, active)

    expect(behaviour).toEqual({
      verbose: true,
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at', defaultOrderColumn: 'created_at' },
      pagination: { defaultPerPage: 25, cursorColumn: 'id' },
    })
    expect(conflicts).toEqual([`database 'database/stacks.sqlite' (config/database.ts resolved '/tmp/qa.sqlite')`])
  })

  it('names a dialect that disagrees too', () => {
    expect(splitProjectQueryBuilderConfig({ dialect: 'postgres' }, active).conflicts)
      .toEqual([`dialect 'postgres' (config/database.ts resolved 'sqlite')`])
  })

  it('says nothing when the file only restates the connection in force', () => {
    expect(splitProjectQueryBuilderConfig({ dialect: 'sqlite', database: { database: '/tmp/qa.sqlite' } }, active).conflicts).toEqual([])
  })

  it('treats a missing or empty file as nothing to apply', () => {
    expect(splitProjectQueryBuilderConfig(undefined, active)).toEqual({ behaviour: {}, conflicts: [] })
    expect(splitProjectQueryBuilderConfig({}, active)).toEqual({ behaviour: {}, conflicts: [] })
  })

  it('tells the reader which file to fix', () => {
    expect(connectionConflictWarning(['database \'x\'']))
      .toContain('Remove `dialect` and `database` from config/qb.ts')
  })
})

describe('the route generator with a stale config/qb.ts', () => {
  it('leaves the model layer on DB_DATABASE_PATH, not the database qb.ts names', () => {
    // A project of its own, so `projectPath('config/qb.ts')` finds this file,
    // and a process of its own, so the query builder's process-wide config
    // starts clean.
    const project = mkdtempSync(join(tmpdir(), 'orm-qb-connection-'))
    const target = join(project, 'qa.sqlite')
    try {
      mkdirSync(join(project, 'storage', 'framework'), { recursive: true })
      mkdirSync(join(project, 'config'))
      // Where the stale path points, so a regression reads as the wrong file
      // being opened rather than as a failure to open one.
      mkdirSync(join(project, 'database'))
      writeFileSync(join(project, 'config', 'qb.ts'), `export default {
        verbose: false,
        dialect: 'sqlite',
        database: { database: 'database/stacks.sqlite' },
      }\n`)
      const script = `
        await import(${JSON.stringify(join(import.meta.dir, '../src/routes.ts'))})
        const qb = await import('@stacksjs/query-builder')
        console.log(JSON.stringify({ configured: qb.config.database.database, opened: qb.getDatabase().filename }))
      `
      const run = Bun.spawnSync({
        cmd: [process.execPath, '-e', script],
        cwd: project,
        env: { ...process.env, DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: target, APP_ENV: 'local' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      expect(run.exitCode, run.stderr.toString()).toBe(0)
      const line = run.stdout.toString().trim().split('\n').at(-1) ?? ''
      expect(JSON.parse(line)).toEqual({ configured: target, opened: target })
    }
    finally {
      rmSync(project, { recursive: true, force: true })
    }
  }, 30000)
})
