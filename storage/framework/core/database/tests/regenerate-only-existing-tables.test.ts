/**
 * stacksjs/stacks#2346 - regenerating a corpus into a different dialect.
 *
 * Neither existing route produces one that is both runnable and minimal. The
 * default preserves unmarked files, so wrong-dialect CREATEs survive.
 * `--replace-unmarked` deletes them, but the generator only emits tables whose
 * models the app declares, so a framework table the app relies on without
 * declaring is left behind in the old dialect. Turning on
 * `includeFrameworkDefaults` fixes the dialect by adopting the framework's whole
 * schema: 80 files from 78 models, for an app declaring five.
 *
 * `tablesDefinedByCorpus` is the missing piece: the set a regeneration must
 * reproduce to replace a corpus without changing what it describes.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { GENERATED_MIGRATION_MARKER, historicallyRootedTables, tablesDefinedByCorpus } from '../src/migrations'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'stacks-2346-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function write(name: string, sql: string): string {
  writeFileSync(join(dir, name), sql)
  return name
}

describe('tablesDefinedByCorpus', () => {
  it('finds the table a generated migration creates', () => {
    const file = write('0000000001-create-users-table.sql', 'CREATE TABLE "users" (id INTEGER);\n')

    expect(tablesDefinedByCorpus(dir, [file])).toEqual(['users'])
  })

  it('counts a @generated file, which historicallyRootedTables deliberately skips', () => {
    // The two answer opposite questions. historicallyRootedTables looks only at
    // UNMARKED files, to find roots worth protecting; this needs the full set a
    // regeneration has to reproduce, marked or not.
    const generated = write('0000000002-create-jobs-table.sql', `${GENERATED_MIGRATION_MARKER}\nCREATE TABLE "jobs" (id INTEGER);\n`)

    expect(tablesDefinedByCorpus(dir, [generated])).toEqual(['jobs'])
    expect(historicallyRootedTables(dir, [generated])).toEqual([])
  })

  it('counts unmarked files too, unlike historicallyRootedTables', () => {
    // The distinction that makes this usable for a dialect switch: the roots
    // are exactly what has to be replaced, so they must be in the set.
    const files = [
      write('0000000004-create-users-table.sql', 'CREATE TABLE "users" (id BIGSERIAL);\n'),
      write('0000000008-create-email_suppressions-table.sql', 'CREATE TABLE "email_suppressions" (id SERIAL);\n'),
    ]

    expect(tablesDefinedByCorpus(dir, files).sort()).toEqual(['email_suppressions', 'users'])
  })

  it('ignores files that only alter, so nothing is invented', () => {
    const files = [
      write('0000000001-create-projects-table.sql', 'CREATE TABLE "projects" (id INTEGER);\n'),
      write('0000000011-auto-misc.sql', 'ALTER TABLE "projects" ALTER COLUMN "ingest_key" TYPE varchar(255);\n'),
    ]

    expect(tablesDefinedByCorpus(dir, files)).toEqual(['projects'])
  })

  it('reads several CREATEs out of one file', () => {
    const file = write('0000000001-init.sql', 'CREATE TABLE "a" (id INTEGER);\nCREATE TABLE "b" (id INTEGER);\n')

    expect(tablesDefinedByCorpus(dir, [file]).sort()).toEqual(['a', 'b'])
  })

  it('handles IF NOT EXISTS and unquoted names', () => {
    const file = write('0000000001-init.sql', 'CREATE TABLE IF NOT EXISTS jobs (id INTEGER);\n')

    expect(tablesDefinedByCorpus(dir, [file])).toEqual(['jobs'])
  })

  it('lowercases, so one table is never counted twice', () => {
    const files = [
      write('0000000001-a.sql', 'CREATE TABLE "Users" (id INTEGER);\n'),
      write('0000000002-b.sql', 'CREATE TABLE "users" (id INTEGER);\n'),
    ]

    expect(tablesDefinedByCorpus(dir, files)).toEqual(['users'])
  })

  it('is empty for a corpus with no CREATE TABLE at all', () => {
    const file = write('0000000001-alter.sql', 'ALTER TABLE "users" ADD COLUMN "x" TEXT;\n')

    expect(tablesDefinedByCorpus(dir, [file])).toEqual([])
  })

  it('skips a file it cannot read rather than throwing', () => {
    write('0000000001-create-users-table.sql', 'CREATE TABLE "users" (id INTEGER);\n')

    expect(tablesDefinedByCorpus(dir, ['0000000001-create-users-table.sql', 'gone.sql'])).toEqual(['users'])
  })

  it('covers the reported corpus: every table, whoever authored the file', () => {
    // The shape from the issue: postgres-flavoured files, some generated and
    // some not, including a framework table the app never declared.
    const files = [
      write('0000000004-create-users-table.sql', 'CREATE TABLE "users" (id BIGSERIAL PRIMARY KEY);\n'),
      write('0000000005-create-subscriptions-table.sql', 'CREATE TABLE "subscriptions" (id BIGSERIAL);\n'),
      write('0000000008-create-email_suppressions-table.sql', 'CREATE TABLE "email_suppressions" (id SERIAL);\n'),
      write('0000000010-create-projects-table.sql', 'CREATE TABLE "projects" (id INTEGER);\n'),
      write('0000000011-auto-misc.sql', 'ALTER TABLE "projects" ALTER COLUMN "ingest_key" TYPE varchar(255);\n'),
    ]

    expect(tablesDefinedByCorpus(dir, files).sort())
      .toEqual(['email_suppressions', 'projects', 'subscriptions', 'users'])
  })
})
