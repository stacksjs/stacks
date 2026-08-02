/**
 * `CREATE TYPE` has no `IF NOT EXISTS`, so a corpus containing one could only
 * ever be applied to a database that had never seen it.
 *
 * Anything that leaves the ledger behind the schema - an interrupted run, a
 * restored dump, a database built before the ledger existed - stopped `buddy
 * migrate` dead on the first enum it met, with an error naming a type that was
 * already exactly right. The only way out was `migrate:fresh`, which drops
 * everything.
 *
 * The guard is a `DO` block, whose body has to be dollar-quoted. That is why
 * the statement splitter has to understand dollar quoting: without it the guard
 * is torn apart on the semicolons inside it and the fragments are not valid SQL.
 */

import { describe, expect, it } from 'bun:test'
import { guardPostgresEnumTypes, orderPostgresColumnTypeChanges, sqlStatementsOf } from '../src/migrations'

describe('guardPostgresEnumTypes', () => {
  it('wraps a bare CREATE TYPE so a second run is a no-op', () => {
    const guarded = guardPostgresEnumTypes('CREATE TYPE "issues_state_type" AS ENUM (\'open\', \'closed\');')

    expect(guarded).toContain('DO $stacks$')
    expect(guarded).toContain('EXCEPTION WHEN duplicate_object THEN null')
    expect(guarded).toContain('CREATE TYPE "issues_state_type" AS ENUM (\'open\', \'closed\')')
  })

  it('keeps the members exactly', () => {
    const guarded = guardPostgresEnumTypes('CREATE TYPE "t" AS ENUM (\'a\', \'b\', \'c\')')

    expect(guarded).toContain('(\'a\', \'b\', \'c\')')
  })

  it('guards several in one file', () => {
    const sql = [
      'CREATE TYPE "a_type" AS ENUM (\'x\');',
      'CREATE TYPE "b_type" AS ENUM (\'y\');',
    ].join('\n')

    expect([...guardPostgresEnumTypes(sql).matchAll(/DO \$stacks\$/g)]).toHaveLength(2)
  })

  it('leaves everything else alone', () => {
    const sql = 'ALTER TABLE "issues" ADD COLUMN "state" text;'

    expect(guardPostgresEnumTypes(sql)).toBe(sql)
  })

  /** Running the transform twice must not nest the guard. */
  it('is itself idempotent', () => {
    const once = guardPostgresEnumTypes('CREATE TYPE "t" AS ENUM (\'a\')')

    expect(guardPostgresEnumTypes(once)).toBe(once)
  })

  it('is case insensitive, because hand-written migrations are not consistent', () => {
    expect(guardPostgresEnumTypes('create type "t" as enum (\'a\')')).toContain('DO $stacks$')
  })
})

describe('sqlStatementsOf', () => {
  it('splits ordinary statements', () => {
    expect(sqlStatementsOf('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2'])
  })

  it('drops comments and blank chunks', () => {
    const sql = '-- a header\nSELECT 1;\n-- trailing note\n'

    expect(sqlStatementsOf(sql)).toEqual(['SELECT 1'])
  })

  /**
   * The case the guard depends on: two semicolons live inside the body, and
   * splitting on them produces fragments that are not statements.
   */
  it('keeps a dollar-quoted body in one piece', () => {
    const sql = 'DO $stacks$ BEGIN CREATE TYPE "t" AS ENUM (\'a\'); EXCEPTION WHEN duplicate_object THEN null; END $stacks$;'

    const statements = sqlStatementsOf(sql)

    expect(statements).toHaveLength(1)
    expect(statements[0]).toContain('EXCEPTION WHEN duplicate_object')
  })

  it('handles a bare $$ body as well as a tagged one', () => {
    const sql = 'DO $$ BEGIN a; b; END $$;'

    expect(sqlStatementsOf(sql)).toHaveLength(1)
  })

  it('splits statements either side of a dollar-quoted one', () => {
    const sql = 'SELECT 1; DO $stacks$ BEGIN x; y; END $stacks$; SELECT 2;'

    expect(sqlStatementsOf(sql)).toHaveLength(3)
  })

  /** A semicolon inside a string literal is data, not punctuation. */
  it('does not split inside a string literal', () => {
    const statements = sqlStatementsOf('INSERT INTO t VALUES (\'a;b\');')

    expect(statements).toHaveLength(1)
    expect(statements[0]).toContain('a;b')
  })

  it('does not split inside a quoted identifier', () => {
    expect(sqlStatementsOf('SELECT "od;d" FROM t;')).toHaveLength(1)
  })

  /** A `--` inside a string is part of the value, not the start of a comment. */
  it('does not treat a dash pair inside a string as a comment', () => {
    const statements = sqlStatementsOf('INSERT INTO t VALUES (\'a--b\');')

    expect(statements[0]).toContain('a--b')
  })

  it('copes with a statement that has no trailing semicolon', () => {
    expect(sqlStatementsOf('SELECT 1')).toEqual(['SELECT 1'])
  })

  it('returns nothing for an empty or comment-only file', () => {
    expect(sqlStatementsOf('')).toEqual([])
    expect(sqlStatementsOf('-- nothing here\n')).toEqual([])
  })

  /** The guard and the splitter have to agree, or neither is any use. */
  it('round-trips a guarded CREATE TYPE as exactly one statement', () => {
    const guarded = guardPostgresEnumTypes('CREATE TYPE "t" AS ENUM (\'a\', \'b\');')

    expect(sqlStatementsOf(guarded)).toHaveLength(1)
  })
})

/**
 * Migration files are history. The generator emits `DROP DEFAULT` before a type
 * change now, but every corpus written before that still carries the old order,
 * and re-running one fails on any database that has not caught up.
 */
describe('orderPostgresColumnTypeChanges', () => {
  it('puts a DROP DEFAULT in front of a type change', () => {
    const sql = 'ALTER TABLE "t" ALTER COLUMN "status" TYPE "t_status_type" USING "status"::"t_status_type";'
    const lines = orderPostgresColumnTypeChanges(sql).split('\n')

    expect(lines[0]).toBe('ALTER TABLE "t" ALTER COLUMN "status" DROP DEFAULT;')
    expect(lines[1]).toContain('TYPE')
  })

  it('keeps the indentation of the statement it precedes', () => {
    const sql = '  ALTER TABLE "t" ALTER COLUMN "c" TYPE boolean USING "c"::boolean;'

    expect(orderPostgresColumnTypeChanges(sql).split('\n')[0]).toBe('  ALTER TABLE "t" ALTER COLUMN "c" DROP DEFAULT;')
  })

  /** Running the pass twice must not stack a second drop on every type change. */
  it('is idempotent', () => {
    const sql = 'ALTER TABLE "t" ALTER COLUMN "c" TYPE boolean USING "c"::boolean;'
    const once = orderPostgresColumnTypeChanges(sql)

    expect(orderPostgresColumnTypeChanges(once)).toBe(once)
  })

  it('leaves an existing drop alone', () => {
    const sql = [
      'ALTER TABLE "t" ALTER COLUMN "c" DROP DEFAULT;',
      'ALTER TABLE "t" ALTER COLUMN "c" TYPE boolean USING "c"::boolean;',
    ].join('\n')

    expect(orderPostgresColumnTypeChanges(sql)).toBe(sql)
  })

  it('handles several columns in one file', () => {
    const sql = [
      'ALTER TABLE "a" ALTER COLUMN "x" TYPE boolean USING "x"::boolean;',
      'ALTER TABLE "b" ALTER COLUMN "y" TYPE boolean USING "y"::boolean;',
    ].join('\n')

    const out = orderPostgresColumnTypeChanges(sql)

    expect([...out.matchAll(/DROP DEFAULT/g)]).toHaveLength(2)
    expect(out).toContain('ALTER TABLE "a" ALTER COLUMN "x" DROP DEFAULT;')
    expect(out).toContain('ALTER TABLE "b" ALTER COLUMN "y" DROP DEFAULT;')
  })

  it('leaves everything else untouched', () => {
    const sql = 'ALTER TABLE "t" ADD COLUMN "c" text;\nCREATE INDEX "i" ON "t" ("c");'

    expect(orderPostgresColumnTypeChanges(sql)).toBe(sql)
  })

  /** A column being set NOT NULL is not a type change and needs no drop. */
  it('ignores a nullability change', () => {
    const sql = 'ALTER TABLE "t" ALTER COLUMN "c" SET NOT NULL;'

    expect(orderPostgresColumnTypeChanges(sql)).toBe(sql)
  })
})
