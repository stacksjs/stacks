import { describe, expect, it } from 'bun:test'
import { onBoxDatabase } from '../src/commands/cloud'

/**
 * A Postgres or MySQL database on the box lives in the engine's own data
 * directory, not in the site tree - so moving the tree alone passes every check
 * in the plan (the app starts, answers its health gate, takes the DNS cutover)
 * and then serves production an empty database.
 *
 * Naming it in the plan's options with no effects to carry it is what makes
 * `planSiteMove` refuse. Getting this predicate wrong in either direction is
 * expensive: too eager and no project can move, too shy and one loses its data.
 */

/** `infrastructure.appDatabase` is ts-cloud's canonical key for this block. */
const declares = (appDatabase: any) => ({ infrastructure: { appDatabase } })

describe('onBoxDatabase', () => {
  it('names a co-located engine database, which is what makes the move refuse', async () => {
    expect(await onBoxDatabase(declares({ engine: 'postgres', name: 'shop' }))).toEqual({ name: 'shop' })
  })

  it('says nothing for a managed database both boxes reach the same way', async () => {
    expect(await onBoxDatabase(declares({ engine: 'postgres', name: 'shop', host: 'db.example.com' }))).toBeUndefined()
  })

  /** SQLite lives under `shared/`, which the tree carries already. */
  it('says nothing for sqlite, which rides along in the tree', async () => {
    expect(await onBoxDatabase(declares({ engine: 'sqlite', name: 'shop' }))).toBeUndefined()
  })

  it('says nothing when the project declares no database at all', async () => {
    expect(await onBoxDatabase({})).toBeUndefined()
    expect(await onBoxDatabase(declares(undefined))).toBeUndefined()
  })

  /**
   * Early configs declared the same block under `infrastructure.compute.database`,
   * and ts-cloud still honours it. Reading only the canonical key here would let
   * one of those projects move and leave its data behind - the exact failure the
   * refusal exists to prevent.
   */
  it('honours the older compute.database spelling ts-cloud still resolves', async () => {
    const older = { infrastructure: { compute: { database: { engine: 'postgres', name: 'bughq' } } } }

    expect(await onBoxDatabase(older)).toEqual({ name: 'bughq' })
  })

  /**
   * A local engine with no name cannot be dumped, restored, or even reported,
   * and naming it `''` would make the refusal message meaningless.
   */
  it('says nothing for a local engine it cannot name', async () => {
    expect(await onBoxDatabase(declares({ engine: 'mysql' }))).toBeUndefined()
  })

  it('treats an explicit loopback host as on the box, not as external', async () => {
    expect(await onBoxDatabase(declares({ engine: 'mysql', name: 'shop', host: '127.0.0.1' }))).toEqual({ name: 'shop' })
  })
})
