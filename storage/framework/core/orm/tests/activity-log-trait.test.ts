import { describe, expect, it } from 'bun:test'
import {
  applyActivityLog,
  describeActivity,
  resolveActivityLogOptions,
  selectLoggedProperties,
} from '../src/traits/activity-log'

/**
 * `traits: { useActivityLog: true }` writes an `activities` row per create,
 * update and delete - what happened, to which record, by whom, from where.
 *
 * Distinct from `useAudit`, which writes `model_audits` rows carrying an
 * old/new diff. The tables say which is which: `activities` has `description`,
 * `subject_type`, `causer` and `ip_address` and the `Activity` model ships
 * `useApi: { routes: ['index', 'show'] }`, because a person reads it.
 *
 * @see https://github.com/stacksjs/stacks/issues/2435
 */

describe('resolveActivityLogOptions', () => {
  it('reads `true` as "log everything the filters allow"', () => {
    expect(resolveActivityLogOptions(true)).toEqual({})
  })

  it('is null when the trait is off, so no wrapper is installed at all', () => {
    expect(resolveActivityLogOptions(undefined)).toBeNull()
    expect(resolveActivityLogOptions(false)).toBeNull()
  })

  it('keeps the three selectors and ignores anything else', () => {
    expect(resolveActivityLogOptions({ logOnly: ['a'], include: ['b'], exclude: ['c'], nonsense: 1 } as any))
      .toEqual({ logOnly: ['a'], include: ['b'], exclude: ['c'] })
  })

  it('ignores a selector that is not a list', () => {
    expect(resolveActivityLogOptions({ logOnly: 'name' } as any)).toEqual({ logOnly: undefined, include: undefined, exclude: undefined })
  })
})

describe('selectLoggedProperties', () => {
  const row = { id: 1, name: 'Ada', email: 'ada@example.com', password: 'hash', api_key: 'k', reset_token: 't', note: 'n' }

  it('never records a credential, whatever the selectors say', () => {
    const logged = selectLoggedProperties(row, { logOnly: ['password', 'api_key', 'reset_token', 'name'] })

    expect(logged).toEqual({ name: 'Ada' })
  })

  it('drops the attributes the model declared hidden', () => {
    expect(selectLoggedProperties(row, {}, ['email'])).not.toHaveProperty('email')
  })

  /** Naming a column is not a reason to put it in a feed. */
  it('will not let logOnly pull a hidden attribute back in', () => {
    expect(selectLoggedProperties(row, { logOnly: ['email', 'name'] }, ['email'])).toEqual({ name: 'Ada' })
  })

  it('records only what logOnly names', () => {
    expect(selectLoggedProperties(row, { logOnly: ['name', 'note'] })).toEqual({ name: 'Ada', note: 'n' })
  })

  it('treats include as the same thing, which is Spatie\'s spelling', () => {
    expect(selectLoggedProperties(row, { include: ['note'] })).toEqual({ note: 'n' })
  })

  it('lets logOnly win when both are given', () => {
    expect(selectLoggedProperties(row, { logOnly: ['name'], include: ['note'] })).toEqual({ name: 'Ada' })
  })

  it('applies exclude after the selection', () => {
    expect(selectLoggedProperties(row, { logOnly: ['name', 'note'], exclude: ['note'] })).toEqual({ name: 'Ada' })
    expect(selectLoggedProperties(row, { exclude: ['note'] })).not.toHaveProperty('note')
  })

  it('is null for a row that is not there', () => {
    expect(selectLoggedProperties(undefined, {})).toBeNull()
  })
})

describe('describeActivity', () => {
  it('names the record when there is one', () => {
    expect(describeActivity('Widget', 'created', 7)).toBe('Widget 7 was created')
  })

  it('still says something when the id is unknown', () => {
    expect(describeActivity('Widget', 'deleted', null)).toBe('Widget was deleted')
  })
})

describe('applyActivityLog', () => {
  function fakeModel() {
    const calls: string[] = []
    const rows = new Map<number, Record<string, unknown>>([[1, { id: 1, name: 'before' }]])
    return {
      calls,
      rows,
      model: {
        create: async (data: Record<string, unknown>) => { calls.push('create'); return { id: 2, ...data } },
        update: async (id: number, data: Record<string, unknown>) => { calls.push('update'); return { id, ...data } },
        delete: async (id: number) => { calls.push('delete'); rows.delete(id); return true },
        find: async (id: number) => rows.get(id) ?? null,
      } as Record<string, unknown>,
    }
  }

  it('wraps the three write paths', () => {
    const { model } = fakeModel()
    const before = { create: model.create, update: model.update, delete: model.delete }

    applyActivityLog(model, 'Widget', 'id', {})

    expect(model.create).not.toBe(before.create)
    expect(model.update).not.toBe(before.update)
    expect(model.delete).not.toBe(before.delete)
  })

  /**
   * Wrapped rather than hooked because bun-query-builder's `afterUpdate` and
   * `afterDelete` do not fire for the static `Model.update(id, …)` and
   * `Model.delete(id)` paths - which is how most application code writes. The
   * first version of this used hooks, logged the create, and silently missed
   * both of the others.
   */
  it('still calls through to the original write', async () => {
    const { calls, model } = fakeModel()
    applyActivityLog(model, 'Widget', 'id', {})

    await (model.create as any)({ name: 'x' })
    await (model.update as any)(1, { name: 'y' })
    await (model.delete as any)(1)

    expect(calls).toEqual(['create', 'update', 'delete'])
  })

  it('leaves Activity alone, or the feed would describe itself forever', () => {
    const { model } = fakeModel()
    const before = { create: model.create, update: model.update, delete: model.delete }

    applyActivityLog(model, 'Activity', 'id', {})

    expect(model.create).toBe(before.create)
    expect(model.update).toBe(before.update)
    expect(model.delete).toBe(before.delete)
  })

  it('does not wrap a method the model does not have', () => {
    const partial: Record<string, unknown> = { create: async () => ({ id: 1 }) }

    applyActivityLog(partial, 'Widget', 'id', {})

    expect(partial.update).toBeUndefined()
    expect(partial.delete).toBeUndefined()
  })
})
