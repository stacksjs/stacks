import assert from 'node:assert/strict'
import { retry } from '../../src/utils/retry'
let calls = 0
const operation = retry(async () => { if (++calls < 3) throw new Error('transient'); return 42 }, { retries: 2, initialDelay: 2147483648, backoffFactor: 2, jitter: false })
await Promise.race([operation, Bun.sleep(30)])
assert.equal(calls, 1, 'a long delay must not collapse into millisecond retries')
console.log('long retry delay OK')
// This isolated process owns the intentionally long pending timer.
process.exit(0)
