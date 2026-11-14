import { mock } from 'bun:test'
import assert from 'node:assert/strict'
import * as crypto from 'node:crypto'

// The randomness boundary is controlled only in this disposable process.
// 0xff bytes reproduce the old base64url filter's completely empty result.
const values = [0, 2821109907455, 0, 2821109907455]
let byteCalls = 0, integerCalls = 0
mock.module('node:crypto', () => ({
  ...crypto,
  randomBytes: (length: number) => { byteCalls++; return Buffer.alloc(length, 255) },
  randomInt: (maximum: number) => {
    assert.equal(maximum, 2821109907456, 'sample the full eight-digit base36 space')
    assert.ok(values.length, 'unexpected extra random draw')
    integerCalls++
    return values.shift()!
  },
}))

// Import after installing the child-only RNG boundary, through the public barrel.
const { uniqueSlug } = await import('../../src/index')
assert.equal(await uniqueSlug('Normal Title'), 'normal-title')
assert.equal(integerCalls, 0, 'ordinary titles do not need randomness')
assert.equal(await uniqueSlug('!!!'), '00000000', 'lowest sample must retain all eight digits')
assert.equal(await uniqueSlug('🎉'), 'zzzzzzzz', 'highest sample must retain all eight digits')

// All 1000 candidates are already claimed in this batch, so none needs SQL.
// This exercises the bounded collision path, not a mocked database result.
const claimed = new Set(['crowded'])
for (let counter = 2; counter <= 1000; counter++) claimed.add(`crowded-${counter}`)
const options = {
  table: 'posts' as const,
  column: 'slug',
  claimed,
  connection: { selectFrom() { throw new Error('Claimed candidates must not query the database') } },
}
assert.equal(await uniqueSlug('Crowded', options), 'crowded-00000000')
assert.ok(claimed.has('crowded-00000000'), 'the low collision fallback is claimed')
assert.equal(await uniqueSlug('Crowded', options), 'crowded-zzzzzzzz')
assert.ok(claimed.has('crowded-zzzzzzzz'), 'the high collision fallback is claimed')
assert.equal(claimed.size, 1002)
assert.equal(integerCalls, 4)
assert.equal(byteCalls, 0)
assert.deepEqual(values, [])
console.info('uniqueSlug bounded crypto entropy OK')
