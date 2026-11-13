import assert from 'node:assert/strict'
import { db, ensureDatabaseConfigLoaded } from '../../src/utils'
import { claimRowLease } from '../../src/row-lease'
import { overridesReady } from '@stacksjs/config'
await overridesReady
await ensureDatabaseConfigLoaded()
const columns = { token: 'lease_token', heartbeat: 'heartbeat' }
if (process.env.LEASE_CHILD) {
  assert.equal(await claimRowLease('lease_subjects', { id: 1, owner: 7 }, columns, 10000), null)
  console.log('child excluded')
}
else {
  await db.unsafe('CREATE TABLE lease_subjects (id INTEGER PRIMARY KEY, owner INTEGER NOT NULL, lease_token TEXT, heartbeat TEXT, value INTEGER)').execute()
  await db.insertInto('lease_subjects').values({ id: 1, owner: 7, value: 0 }).execute()
  assert.equal(await claimRowLease('lease_subjects', { id: 1, owner: 8 }, columns, 10000), null)
  await db.insertInto('lease_subjects').values([{ id: 2, owner: 8, value: 0 }, { id: 3, owner: 8, value: 0 }]).execute()
  await assert.rejects(claimRowLease('lease_subjects', { owner: 8 }, columns, 10000), /unique scope/)
  const untouched = await db.selectFrom('lease_subjects').select('lease_token').where('owner', '=', 8).execute()
  assert(untouched.every(row => row.lease_token === null), 'a broad scope cannot lease any matching row')

  const first = await claimRowLease('lease_subjects', { id: 1, owner: 7 }, columns, 10000)
  assert(first)
  assert.equal(await first.renew(), true)
  const child = Bun.spawn([process.execPath, import.meta.filename], { env: { ...process.env, LEASE_CHILD: '1' }, stdout: 'pipe', stderr: 'pipe' })
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  assert.equal(code, 0, err)
  assert(out.includes('child excluded'))
  await first.commit(async () => { await db.updateTable('lease_subjects').set({ value: 1 }).where('id', '=', 1).execute() })
  await db.updateTable('lease_subjects').set({ heartbeat: '2000-01-01T00:00:00Z' }).where('id', '=', 1).execute()
  const second = await claimRowLease('lease_subjects', { id: 1, owner: 7 }, columns, 10000)
  assert(second)
  assert.notEqual(first.token, second.token)
  assert.equal(await first.renew(), false)
  await first.release()
  await second.assertOwned()
  await assert.rejects(async () => first.commit(async () => { await db.updateTable('lease_subjects').set({ value: 99 }).where('id', '=', 1).execute() }), /ownership was lost/)
  assert.equal((await db.selectFrom('lease_subjects').select('value').where('id', '=', 1).executeTakeFirst())?.value, 1)
  await second.release()
  assert(await claimRowLease('lease_subjects', { id: 1, owner: 7 }, columns, 10000))
  console.log('row leases OK')
}
