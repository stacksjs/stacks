import assert from 'node:assert/strict'
import { mock } from 'bun:test'

const database = { ...await import('@stacksjs/database/runtime') }
let failure: unknown
mock.module('@stacksjs/database/runtime', () => ({ ...database,
  db: { transaction: async () => { throw failure } },
}))
const { revokeMagicLinks } = await import('../../src/magic-link-revocation')
const { revokeTwoFactorChallenges } = await import('../../src/two-factor')

for (const [table, revoke] of [
  ['magic_link_tokens', revokeMagicLinks],
  ['two_factor_challenges', revokeTwoFactorChallenges],
] as const) {
  for (const message of [
    `no such table: ${table}`,
    `relation "${table}" does not exist`,
    `Table 'fixture.${table}' doesn't exist`,
  ]) {
    for (const asRecord of [false, true]) {
      failure = asRecord ? { code: 'ERR_MYSQL_SERVER_ERROR', message } : new Error(message)
      await revoke(1)
    }
  }
  for (const message of [
    "Table 'fixture.missing_audit' doesn't exist",
    `permission denied for table ${table}`,
    `failed trigger on ${table}: no such table: missing_audit`,
  ]) {
    failure = { message }
    await assert.rejects(revoke(1), error => error === failure)
  }
  for (const value of [null, undefined, { message: 123 }, 'unknown failure']) {
    failure = value
    let caught = false
    try { await revoke(1) }
    catch (error) { caught = true; assert.equal(error, value) }
    assert(caught, 'unknown failures must propagate')
  }
}
console.log('recovery error records OK')
