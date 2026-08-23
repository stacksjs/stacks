import type { DeclaredFK, LiveFK } from '../src/fk-audit'
import { describe, expect, it } from 'bun:test'
import { classifyDeclaredFKs, fkKey, getDeclaredFKs, getDeclaredFKsFromModels } from '../src/fk-audit'

// stacksjs/stacks#1916 — Declared-FK enumeration smoke test.
//
// We don't load every model file in the framework (some require a
// live DB / config to import); instead this test trusts that
// `getDeclaredFKs()` is resilient to model-import failures (returns
// the FKs it CAN compute, skips the rest) and verifies that the
// known default models — User, Post, Comment, Tag — produce the
// expected FK list.

describe('getDeclaredFKs (stacksjs/stacks#1916)', () => {
  it('uses actual model tables and explicit attribute foreign keys', () => {
    const fks = getDeclaredFKsFromModels([
      { name: 'User', table: 'users', primaryKey: 'id', attributes: {} },
      {
        name: 'CheckIn',
        table: 'checkins',
        primaryKey: 'id',
        attributes: { user_id: { foreignKey: { table: 'users', nullable: false }, validation: { rule: {} } } },
      },
      {
        name: 'AccessEvent',
        table: 'access_events',
        attributes: { check_in_id: { foreignKey: { table: 'checkins' }, validation: { rule: {} } } },
        belongsTo: ['CheckIn'],
      },
    ] as any)

    expect(fks).toContainEqual({
      fromTable: 'access_events',
      fromColumn: 'check_in_id',
      toTable: 'checkins',
      toColumn: 'id',
      model: 'AccessEvent',
    })
    expect(fks.some(fk => fk.toTable === 'check_ins')).toBe(false)
  })

  it('returns an array of declared FKs without throwing on partial model load', async () => {
    const fks = await getDeclaredFKs()
    expect(Array.isArray(fks)).toBe(true)
  })

  it('emits the conventional <related>_id → <related>.id shape', async () => {
    const fks = await getDeclaredFKs()
    for (const fk of fks) {
      expect(fk.fromColumn).toMatch(/_id$/)
      expect(fk.toColumn).toBe('id')
      // Both sides should be snake_case plural tables (or singular
      // for irregular plurals, which is also fine — we don't pin a
      // specific table here).
      expect(fk.fromTable).toMatch(/^[a-z][\w]*$/)
      expect(fk.toTable).toMatch(/^[a-z][\w]*$/)
    }
  })

  it('every declared FK carries the source model name', async () => {
    const fks = await getDeclaredFKs()
    for (const fk of fks) {
      expect(typeof fk.model).toBe('string')
      // model is allowed to be '' on models whose `.name` resolves
      // to undefined (very rare; we keep the entry so the audit
      // doesn't silently drop it).
    }
  })
})

// The auditor and the migration generator have to agree about what counts as
// "declared", or the audit reports differences that are not defects — and then
// recommends `migrate:fresh`, which is destructive, to reconcile them.
//
// bun-query-builder's rule (`migrations.ts`, `declaresBelongsTo`): convention
// applies only to a model that declares no `belongsTo`. Once a model documents
// its relations, a `_id` column outside that list is a column that happens to
// end in `_id`.
describe('declared FKs mirror the generator\'s belongsTo rule', () => {
  const models = [
    { name: 'Session', table: 'sessions', primaryKey: 'id', attributes: {} },
    { name: 'Turn', table: 'turns', primaryKey: 'id', attributes: {} },
    {
      // Declares its relations, so only `session_id` is a foreign key.
      name: 'Checkpoint',
      table: 'checkpoints',
      attributes: { sessionId: { validation: {} }, turnId: { validation: {} } },
      belongsTo: ['Session'],
    },
    {
      // Declares none, so convention applies to both columns.
      name: 'Event',
      table: 'events',
      attributes: { sessionId: { validation: {} }, turnId: { validation: {} } },
    },
  ] as any

  function fksFor(table: string): string[] {
    return getDeclaredFKsFromModels(models)
      .filter(fk => fk.fromTable === table)
      .map(fk => `${fk.fromColumn}→${fk.toTable}`)
      .sort()
  }

  it('honours a declared relation', () => {
    expect(fksFor('checkpoints')).toContain('session_id→sessions')
  })

  it('does not invent one the generator will never emit', () => {
    // `turn_id` is real and points at turns, but Checkpoint never said so. The
    // generator omits the constraint, so claiming it is missing is noise.
    expect(fksFor('checkpoints')).not.toContain('turn_id→turns')
  })

  it('still infers by convention for a model that declares nothing', () => {
    expect(fksFor('events')).toEqual(['session_id→sessions', 'turn_id→turns'])
  })

  it('lets an explicit attribute foreignKey win even when belongsTo is declared', () => {
    const fks = getDeclaredFKsFromModels([
      { name: 'Turn', table: 'turns', primaryKey: 'id', attributes: {} },
      { name: 'Session', table: 'sessions', primaryKey: 'id', attributes: {} },
      {
        name: 'Checkpoint',
        table: 'checkpoints',
        attributes: { turnId: { foreignKey: { table: 'turns' } } },
        belongsTo: ['Session'],
      },
    ] as any)
    expect(fks.map(fk => `${fk.fromColumn}→${fk.toTable}`)).toContain('turn_id→turns')
  })
})

/**
 * A declared FK on a table that is not in the database is not a missing
 * constraint.
 *
 * `buddy migrate` gates out the migrations of features an app has not
 * installed - it says so, by name, on every run. The FK audit then reported
 * the foreign keys belonging to those very tables as "missing from the live
 * schema", suggesting `migrate:fresh` to fix a database that was correct.
 * Four false warnings on every migrate is how a warning stops being read.
 *
 * The distinction has to survive: the audit exists to catch a table that IS
 * there with no constraint enforcing its references, and that finding must
 * still come through.
 */
describe('auditForeignKeys, absent tables vs missing constraints', () => {
  const declared: DeclaredFK[] = [
    { fromTable: 'posts', fromColumn: 'author_id', toTable: 'authors', toColumn: 'id', model: 'Post' },
    { fromTable: 'forms', fromColumn: 'site_id', toTable: 'sites', toColumn: 'id', model: 'Form' },
  ]

  /**
   * The real classifier, over injected inputs. auditForeignKeys() itself needs
   * a live database and every model file; this is the rule it delegates to, so
   * the test moves when the shipped code does rather than restating it.
   */
  const classify = (liveFks: LiveFK[], liveTables: Set<string>) =>
    classifyDeclaredFKs(declared, new Set(liveFks.map(fkKey)), liveTables)

  it('does not report a gated feature table as a missing FK', () => {
    // posts exists and has its FK; forms was never migrated.
    const result = classify(
      [{ fromTable: 'posts', fromColumn: 'author_id', toTable: 'authors', toColumn: 'id' }],
      new Set(['posts', 'authors', 'sites']),
    )

    expect(result.missing).toHaveLength(0)
    expect(result.absentTable.map(fk => fk.fromTable)).toEqual(['forms'])
  })

  it('still reports a table that exists but carries no constraint', () => {
    // The finding the audit is for: posts is present, its FK is not.
    const result = classify([], new Set(['posts', 'authors', 'sites']))

    expect(result.missing.map(fk => fk.fromTable)).toEqual(['posts'])
    expect(result.absentTable.map(fk => fk.fromTable)).toEqual(['forms'])
  })

  it('reports nothing as absent when the table list could not be read', () => {
    // An empty catalog means "could not check", not "no tables exist" - the
    // latter would file every declared FK as absent and hide real findings.
    const result = classify([], new Set())

    expect(result.absentTable).toHaveLength(0)
    expect(result.missing).toHaveLength(2)
  })
})
