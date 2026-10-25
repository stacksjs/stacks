import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { runBoundedProcess } from '@stacksjs/cli/process'

const root = resolve(import.meta.dir, '../../../../..')
const cli = join(root, 'storage/framework/core/buddy/src/cli.ts')

for (const command of ['migrate', 'migrate:fresh']) {
  for (const populated of [false, true]) {
    test(`native ${command} ${populated ? 'rejects ambiguous' : 'repairs empty'} legacy pivots`, async () => {
      const directory = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-migrate-trait-')))
      const databasePath = join(directory, 'fixture.sqlite')
      const corpus = join(directory, 'database/migrations/sqlite')
      mkdirSync(corpus, { recursive: true })
      mkdirSync(join(directory, 'storage/framework'), { recursive: true })
      mkdirSync(join(directory, 'app/Models'), { recursive: true })
      symlinkSync(join(root, 'storage/framework/defaults'), join(directory, 'storage/framework/defaults'), 'dir')
      symlinkSync(join(root, 'storage/framework/core'), join(directory, 'storage/framework/core'), 'dir')
      symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir')
      writeFileSync(join(directory, 'package.json'), '{"type":"module"}\n')
      writeFileSync(join(directory, 'bunfig.toml'), 'preload = []\n')
      // Use the workspace's native source aliases for the disposable app model.
      writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({ extends: join(root, 'tsconfig.json') }))
      writeFileSync(join(directory, 'app/Models/Probe.ts'), `import { defineModel } from '@stacksjs/orm'\nexport default defineModel({ name: 'Probe', table: 'probes', attributes: {} })\n`)
      const migration = `CREATE TABLE IF NOT EXISTS taggable_models (id INTEGER PRIMARY KEY, tag_id BIGINT NOT NULL, taggable_type VARCHAR(255) NOT NULL, created_at TEXT, updated_at TEXT);\n${populated ? "INSERT OR IGNORE INTO taggable_models (id, tag_id, taggable_type) VALUES (7, 3, 'posts');" : ''}\n`
      const migrationPath = join(corpus, '0000000001-legacy-trait.sql')
      writeFileSync(migrationPath, migration)
      let complete = false
      let sequence = 0
      async function run(args: string[], probe = false) {
        const result = await runBoundedProcess([process.execPath, `--config=${join(directory, 'bunfig.toml')}`, '--no-env-file', ...(probe ? [] : [cli]), ...args], {
          cwd: directory,
          env: { ...process.env, PATH: `${dirname(process.execPath)}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`, APP_ENV: 'test', NODE_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: databasePath, DB_SNAPSHOT_PATH: join(directory, 'snapshot'), CI: '1' },
          timeoutMs: 90_000, stdoutBytes: 2_000_000, stderrBytes: 2_000_000, strictUtf8: true, label: `Native ${args.join(' ')}`,
        })
        writeFileSync(join(directory, `${sequence}-stdout.log`), result.stdout)
        writeFileSync(join(directory, `${sequence++}-stderr.log`), result.stderr)
        return { ...result, output: result.stdout + result.stderr }
      }
      try {
        const admission = await run(['--eval', `
const { db, ensureDatabaseConfigLoaded, resetDatabaseConnection } = await import(${JSON.stringify(join(root, 'storage/framework/core/database/src/utils.ts'))})
await ensureDatabaseConfigLoaded()
try {
  const rows = await db.unsafe('PRAGMA database_list').execute()
  if (rows.find(row => row.name === 'main')?.file !== process.env.DB_DATABASE_PATH)
    throw new Error('Native fixture database path mismatch before migration')
}
finally { resetDatabaseConnection() }
`], true)
        expect(admission.exitCode, `${directory}: ${admission.output}`).toBe(0)
        const result = await run([command, '--force', ...(command === 'migrate' ? ['--no-generate'] : [])])
        expect(result.exitCode, `${directory}: ${result.output}`).toBe(populated ? 1 : 0)
        const database = new Database(databasePath, { readonly: true })
        try {
          expect(database.query('PRAGMA database_list').all()).toContainEqual({ seq: 0, name: 'main', file: databasePath })
          const columns = database.query<{ name: string }, []>('PRAGMA table_info(taggable_models)').all()
          expect(columns.some(column => column.name === 'taggable_id')).toBe(!populated)
          if (populated) {
            expect(result.output).toContain('Cannot infer taggable_models.taggable_id')
            expect(database.query('SELECT id, tag_id, taggable_type FROM taggable_models').all()).toEqual([{ id: 7, tag_id: 3, taggable_type: 'posts' }])
          }
          else expect(database.query('SELECT COUNT(*) AS n FROM taggable_models').get()).toEqual({ n: 0 })
        }
        finally { database.close() }
        expect(readFileSync(migrationPath, 'utf8')).toBe(migration)
        if (command === 'migrate') {
          const replay = await run(['migrate', '--force', '--no-generate', ...(populated ? ['--no-auth'] : [])])
          expect(replay.exitCode, `${directory}: ${replay.output}`).toBe(0)
          if (populated) {
            const after = new Database(databasePath, { readonly: true })
            try { expect(after.query('SELECT id, tag_id FROM taggable_models').all()).toEqual([{ id: 7, tag_id: 3 }]) }
            finally { after.close() }
          }
        }
        if (command === 'migrate:fresh' && populated) {
          const gated = await run(['migrate:fresh', '--force', '--no-auth'])
          expect(gated.exitCode, `${directory}: ${gated.output}`).toBe(0)
          const after = new Database(databasePath, { readonly: true })
          try {
            expect(after.query<{ name: string }, []>('PRAGMA table_info(taggable_models)').all().some(column => column.name === 'taggable_id')).toBe(false)
            expect(after.query('SELECT id, tag_id FROM taggable_models').all()).toEqual([{ id: 7, tag_id: 3 }])
          }
          finally { after.close() }
        }
        complete = true
      }
      finally { if (complete) rmSync(directory, { recursive: true }) }
    }, 240_000)
  }
}
