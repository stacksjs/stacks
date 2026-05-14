/**
 * Coverage for the belongsToMany pivot mutators surfaced through stacks
 * `defineModel`. Audit top-12 #8 — bun-query-builder owns the BTM
 * RelationBuilder (attach / detach / sync / syncWithoutDetaching / toggle
 * / updateExistingPivot) and exhaustively tests it against a real DB.
 * What that suite does NOT cover is whether the stacks `wrapModelInstance`
 * proxy correctly forwards the callable accessor through to the
 * underlying ModelInstance.
 *
 * Pre-fix risk: a future change to the stacks proxy `get` trap (e.g.
 * special-casing a name that collides with a relation, or returning
 * `Reflect.get(target, prop, recv)` instead of `target` as the receiver)
 * would silently break the BTM accessor — the relation method would
 * either return `undefined` or fail to bind to the inner Proxy that
 * routes belongsToMany names to the builder. This test pins down the
 * surface so that regression is caught at the orm test boundary, not
 * after a downstream Stacks app starts throwing at runtime.
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { configureOrm, getDatabase } from 'bun-query-builder'
import { defineModel } from '../src/define-model'

describe('belongsToMany pivot accessor (audit #8)', () => {
  beforeAll(() => {
    configureOrm({ database: ':memory:' })
    const db = getDatabase()
    db.run('CREATE TABLE coaches (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)')
    db.run('CREATE TABLE athletes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)')
    db.run(`CREATE TABLE coach_athletes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coach_id INTEGER,
      athlete_id INTEGER,
      role TEXT DEFAULT 'shared',
      status TEXT DEFAULT 'active'
    )`)
  })

  const Athlete = defineModel({
    name: 'Athlete',
    table: 'athletes',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      name: { type: 'string', fillable: true },
    },
  } as const)

  const Coach = defineModel({
    name: 'Coach',
    table: 'coaches',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      name: { type: 'string', fillable: true },
    },
    belongsToMany: {
      athletes: {
        model: 'Athlete',
        table: 'coach_athletes',
        foreignKey: 'coach_id',
        relatedKey: 'athlete_id',
        pivot: {
          columns: {
            role: { default: 'shared' },
            status: { default: 'active' },
          },
        },
      },
    },
  } as const)

  // Make sure both definitions register so the BTM resolver can find Athlete.
  void Athlete

  it('exposes the relation as a callable accessor through the stacks proxy', async () => {
    const coach = await (Coach as any).create({ name: 'Smith' })
    expect(typeof (coach as any).athletes).toBe('function')
    const builder = (coach as any).athletes()
    expect(builder).toBeTruthy()
  })

  it.each([
    'attach',
    'detach',
    'sync',
    'toggle',
    'updateExistingPivot',
    'wherePivot',
    'wherePivotIn',
    'wherePivotNotIn',
    'wherePivotNull',
    'wherePivotNotNull',
    'count',
    'exists',
    'first',
    'get',
  ])('the relation builder exposes %s', async (method) => {
    const coach = await (Coach as any).create({ name: 'Smith' })
    const builder = (coach as any).athletes()
    expect(typeof builder[method]).toBe('function')
  })

  it('attach + count round-trip works through the stacks proxy', async () => {
    const coach = await (Coach as any).create({ name: 'Smith' })
    const a1 = await (Athlete as any).create({ name: 'Anna' })
    const a2 = await (Athlete as any).create({ name: 'Bob' })
    const inserted = (coach as any).athletes().attach([a1.id, a2.id])
    expect(inserted).toBe(2)
    expect((coach as any).athletes().count()).toBe(2)
  })

  it('detach removes specific pivot rows', async () => {
    const coach = await (Coach as any).create({ name: 'Detacher' })
    const a1 = await (Athlete as any).create({ name: 'X' })
    const a2 = await (Athlete as any).create({ name: 'Y' })
    ;(coach as any).athletes().attach([a1.id, a2.id])
    expect((coach as any).athletes().count()).toBe(2)
    const removed = (coach as any).athletes().detach(a1.id)
    expect(removed).toBe(1)
    expect((coach as any).athletes().count()).toBe(1)
  })

  it('sync returns an attached/detached/updated breakdown', async () => {
    const coach = await (Coach as any).create({ name: 'Syncer' })
    const a1 = await (Athlete as any).create({ name: 'P' })
    const a2 = await (Athlete as any).create({ name: 'Q' })
    const a3 = await (Athlete as any).create({ name: 'R' })
    ;(coach as any).athletes().attach([a1.id, a2.id])
    const result = (coach as any).athletes().sync([a2.id, a3.id])
    expect(result.attached).toContain(a3.id)
    expect(result.detached).toContain(a1.id)
    // a2 stays — neither attached nor detached
    expect(result.detached).not.toContain(a2.id)
  })

  it('toggle flips presence — attached becomes detached and vice versa', async () => {
    const coach = await (Coach as any).create({ name: 'Toggler' })
    const a1 = await (Athlete as any).create({ name: 'M' })
    const a2 = await (Athlete as any).create({ name: 'N' })
    ;(coach as any).athletes().attach(a1.id)
    const result = (coach as any).athletes().toggle([a1.id, a2.id])
    // a1 was attached → detached now
    expect(result.detached).toContain(a1.id)
    // a2 was missing → attached now
    expect(result.attached).toContain(a2.id)
  })

  it('updateExistingPivot mutates extras on a present row', async () => {
    const coach = await (Coach as any).create({ name: 'Updater' })
    const a = await (Athlete as any).create({ name: 'Z' })
    ;(coach as any).athletes().attach(a.id, { role: 'primary' })
    const updated = (coach as any).athletes().updateExistingPivot(a.id, { role: 'secondary' })
    expect(updated).toBe(1)
    const rows = getDatabase().query(
      'SELECT role FROM coach_athletes WHERE coach_id = ? AND athlete_id = ?',
    ).all(coach.id, a.id) as Array<{ role: string }>
    expect(rows[0]?.role).toBe('secondary')
  })
})
