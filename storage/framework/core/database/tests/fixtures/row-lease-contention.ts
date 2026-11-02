import assert from 'node:assert/strict'
import { overridesReady } from '@stacksjs/config'
import { claimRowLease } from '../../src/row-lease'
import { db, ensureDatabaseConfigLoaded, resetDatabaseConnection } from '../../src/utils'

await overridesReady
await ensureDatabaseConfigLoaded()
if (process.env.LEASE_ISOLATION === 'serializable')
  db.setTransactionDefaults({ isolation: 'serializable' })

try {
  if (process.env.LEASE_CONTENDER) {
    await db.selectFrom('lease_contention').where('id', '=', 1).execute()
    const start = new Promise<void>((resolve) => { process.once('message', () => resolve()) })
    process.send?.('ready')
    await start
    const lease = await claimRowLease('lease_contention', { id: 1 }, { token: 'lease_token', heartbeat: 'heartbeat' }, 60_000)
    console.log(lease ? 'owner' : 'excluded')
  }
  else {
    await db.unsafe('CREATE TABLE lease_contention (id INTEGER PRIMARY KEY, lease_token TEXT, heartbeat TEXT)').execute()
    await db.insertInto('lease_contention').values({ id: 1 }).execute()
    for (const isolation of ['default', 'serializable']) {
      await db.updateTable('lease_contention').set({ lease_token: null, heartbeat: null }).where('id', '=', 1).execute()
      const ready: Promise<void>[] = []
      const children = Array.from({ length: 6 }, () => {
        let resolveReady!: () => void
        const initialized = new Promise<void>((resolve) => { resolveReady = resolve })
        const child = Bun.spawn([process.execPath, '--no-env-file', import.meta.filename], {
          env: { ...process.env, LEASE_CONTENDER: '1', LEASE_ISOLATION: isolation },
          stdout: 'pipe', stderr: 'pipe',
          ipc(message) { if (message === 'ready') resolveReady() },
        })
        ready.push(Promise.race([initialized, child.exited.then(() => { throw new Error('Lease contender exited before the start barrier') })]))
        return child
      })
      try {
        await Promise.all(ready)
        children.forEach(child => child.send('start'))
        const results = await Promise.all(children.map(async (child) => {
          const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
          assert.equal(code, 0, `${isolation}: ${error}`)
          return out.trim()
        }))
        assert.equal(results.filter(result => result === 'owner').length, 1, `${isolation}: exactly one simultaneous claimant wins`)
        assert.equal(results.filter(result => result === 'excluded').length, 5)
      }
      finally { children.forEach(child => child.kill()) }
    }
    if (process.env.DB_CONNECTION === 'postgres') {
      await db.updateTable('lease_contention').set({ lease_token: null, heartbeat: null }).where('id', '=', 1).execute()
      await assert.rejects(db.transaction(async () => {
        assert(await claimRowLease('lease_contention', { id: 1 }, { token: 'lease_token', heartbeat: 'heartbeat' }, 60_000))
        const [isolation] = await db.unsafe('SHOW transaction_isolation').execute()
        assert.equal(isolation?.transaction_isolation, 'serializable', 'claiming cannot weaken its parent isolation')
        throw new Error('rollback parent lease')
      }, { isolation: 'serializable' }), /rollback parent lease/)
      assert.equal((await db.selectFrom('lease_contention').where('id', '=', 1).executeTakeFirst())?.lease_token, null)
    }
    console.log('simultaneous row leases OK')
  }
}
finally { resetDatabaseConnection() }
