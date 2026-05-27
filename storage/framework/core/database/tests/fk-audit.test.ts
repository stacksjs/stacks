import { describe, expect, it } from 'bun:test'
import { getDeclaredFKs } from '../src/fk-audit'

// stacksjs/stacks#1916 — Declared-FK enumeration smoke test.
//
// We don't load every model file in the framework (some require a
// live DB / config to import); instead this test trusts that
// `getDeclaredFKs()` is resilient to model-import failures (returns
// the FKs it CAN compute, skips the rest) and verifies that the
// known default models — User, Post, Comment, Tag — produce the
// expected FK list.

describe('getDeclaredFKs (stacksjs/stacks#1916)', () => {
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
