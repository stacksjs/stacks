/**
 * `buddy migrate` runs the migrations directory, not the models directory.
 *
 * bun-query-builder declared `executeMigration(dir)` and then ignored it,
 * resolving `migrationDir` from its own config instead. Stacks passed
 * `app/Models`, which was wrong the whole time and invisible because the value
 * was discarded.
 *
 * 0.2.63 honours the argument (stacksjs/bun-query-builder#1137). Every
 * production deploy then failed with
 * `Migration directory not found: <app>/app/Models`, and a project that HAS an
 * `app/Models` would have been worse: the directory exists, holds no `.sql`,
 * so the run would report success having applied nothing.
 *
 * Pinned at the source because the failure needs a real database and a real
 * corpus to reproduce, and the thing worth protecting is one argument.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('storage/framework/core/database/src/migrations.ts'), 'utf8')

/** The body of `runDatabaseMigration`, up to the next exported function. */
function runDatabaseMigrationBody(): string {
  const start = source.indexOf('export async function runDatabaseMigration')
  expect(start).toBeGreaterThan(-1)
  const next = source.indexOf('\nexport ', start + 1)
  return source.slice(start, next === -1 ? undefined : next)
}

describe('the migration corpus handed to bun-query-builder', () => {
  test('is the migrations directory, resolved for the dialect', () => {
    const body = runDatabaseMigrationBody()

    expect(body).toContain('migrationDirectory(dialect)')
    expect(body).toContain('qbExecuteMigration(corpusDir)')
  })

  test('is never the models directory', () => {
    const body = runDatabaseMigrationBody()

    expect(body).not.toContain('qbExecuteMigration(modelsDir)')
    expect(body).not.toContain('userModelsPath()')
  })

  test('resetDatabase still gets the models directory, which it does want', () => {
    // It drops the tables the models declare, so `app/Models` is correct there
    // and guarded by its own existsSync. Named here so a future sweep for
    // `userModelsPath` does not "fix" it too.
    const start = source.indexOf('export async function resetDatabase')
    const body = source.slice(start, source.indexOf('\nexport ', start + 1))

    expect(body).toContain('path.userModelsPath()')
    expect(body).toContain('qbResetDatabase(modelsDir')
  })
})
