import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { configureOrm, releaseOrm } from 'bun-query-builder'
import { Action } from '@stacksjs/actions'
import { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '@stacksjs/database/runtime'
import { defineModel } from '@stacksjs/orm'
import { createStacksRouter } from '@stacksjs/router'
import { schema } from '../../src/schema'
import { validate } from '../../src/request-validator'
import { parseNumberInput } from '../../src/input'
import { covariance, standardDeviation, zScore } from '../../../arrays/src/math'
import { zonedTimeToUtc } from '../../../datetime/src/zone'

await ensureDatabaseConfigLoaded()
resetDatabaseConnection()
const directory = await mkdtemp(join(tmpdir(), 'stacks-conditional-contracts-'))
const database = join(directory, 'contracts.sqlite')
initializeDbConfig({ database: { default: 'sqlite', connections: { sqlite: { database } } } })
configureOrm({ database })
await db.unsafe('CREATE TABLE conditional_contracts (id INTEGER PRIMARY KEY AUTOINCREMENT, payment_method TEXT, token TEXT)').execute()
let checks = 0
const token = schema.string().optional().when('paymentMethod', 'card', rule => rule.required().min(3)).custom(() => { checks++; return true }, 'unused')
const attributes = {
  paymentMethod: { fillable: true, default: 'card', validation: { rule: schema.string() } },
  token: { fillable: true, validation: { rule: token, message: { required: 'Card token needed', min: 'Card token too short' } } },
}
const Contract = defineModel({ name: 'ConditionalContract', table: 'conditional_contracts', traits: { useTimestamps: false, useUuid: false }, attributes })
const router = createStacksRouter({ autoDiscoverRoutes: false })
const validations = Object.fromEntries(Object.entries(attributes).map(([field, definition]) => [field, definition.validation]))
router.post('/conditional', new Action({ skipCsrf: true, validations, handle: request => request.getValidated() }) as never)
router.post('/write', new Action({ skipCsrf: true, handle: async request => Contract.create(await request.json()) }) as never)
router.post('/amount', new Action({ skipCsrf: true, handle: async request => ({ amount: parseNumberInput((await request.json()).amount, 'amount', 0, Infinity) }) }) as never)
router.get('/statistics', () => ({ deviation: standardDeviation([1e200, -1e200]), score: zScore([-1e308, 0], 1e308), covariance: covariance([1e200, 1e200, -1e200, -1e200], [1e200, -1e200, 1e200, -1e200]), mixedCovariance: covariance([1e16, -1e16, 1, -1], [1, -1, 1e16, -1e16]) }))
router.get('/schedule', request => {
  try { return { date: zonedTimeToUtc(String(request.get('date')), 'UTC').toISOString() } }
  catch (error) {
    if (error instanceof RangeError) return Response.json({ invalid: true }, { status: 422 })
    throw error
  }
})
const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: request => router.bunRouter.handleRequest(request) })
const post = (path: string, body: unknown) => fetch(`http://127.0.0.1:${server.port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
try {
  await assert.rejects(async () => validate({ paymentMethod: 'card' }, validations), { status: 422 })
  for (const path of ['/conditional', '/write']) {
    const response = await post(path, { paymentMethod: 'card' })
    assert.equal(response.status, 422, path)
    if (path === '/conditional') assert.deepEqual((await response.json()).errors.token, ['Card token needed'])
    assert.equal((await post(path, { paymentMethod: 'card', token: 'x' })).status, 422)
    assert.equal((await post(path, { paymentMethod: 'cash' })).status, 200)
  }
  for (const data of [{ payment_method: 'card' }, {}]) await assert.rejects(async () => Contract.create(data), { name: 'ModelValidationError', status: 422 })
  const row = await Contract.create({ payment_method: 'card', token: 'valid' })
  assert.equal((await Contract.find(row.id))?.token, 'valid')
  await assert.rejects(async () => Contract.update(row.id, { payment_method: 'card', token: 'x' }), { name: 'ModelValidationError', status: 422 })
  assert.equal((await Contract.find(row.id))?.token, 'valid')
  // Updates validate supplied fields only; absent siblings are not fetched implicitly.
  await Contract.update(row.id, { token: 'ok' })
  assert.equal((await Contract.find(row.id))?.token, 'ok')
  checks = 0
  assert.equal((await post('/conditional', { paymentMethod: 'card', token: 'valid' })).status, 200)
  assert.equal(checks, 1)
  assert.equal(token.isRequired, false)
  assert.equal((await post('/amount', { amount: '9007199254740993' })).status, 422)
  assert.deepEqual(await (await post('/amount', { amount: '12.75' })).json(), { amount: 12.75 })
  const base = `http://127.0.0.1:${server.port}`
  assert.deepEqual(await (await fetch(`${base}/statistics`)).json(), { deviation: 1e200, score: 3, covariance: 0, mixedCovariance: 1e16 })
  assert.equal((await fetch(`${base}/schedule?date=2026-02-30T12:00`)).status, 422)
  assert.deepEqual(await (await fetch(`${base}/schedule?date=2024-02-29T12:00`)).json(), { date: '2024-02-29T12:00:00.000Z' })
  console.log('conditional boundaries OK')
}
finally { server.stop(true); resetDatabaseConnection(); await releaseOrm(); await rm(directory, { recursive: true, force: true }) }
