import assert from 'node:assert/strict'
import { realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { completedArtifactLimits, prepareCompletedArtifactDirectorySync } from '../../src/completed-artifact-directory'

const root = realpathSync(process.argv[2]!)
const stage = process.argv[3]
assert(basename(root).startsWith('prepared-artifact-interrupt-'))
assert.equal(dirname(root), realpathSync(tmpdir()))
assert(['prepared', 'payload', 'manifest'].includes(stage!))
const entries = stage === 'payload'
  ? Array.from({ length: 512 }, (_, index) => ({ path: `${String(index).padStart(4, '0')}.bin`, contents: new Uint8Array(4096).fill(90) }))
  : [{ path: 'data.bin', contents: new Uint8Array([90, 90]) }]
const manifest = stage === 'manifest'
  ? JSON.stringify({ padding: 'x'.repeat(completedArtifactLimits.manifestBytes - 14) })
  : '{"version":1}'
const prepared = prepareCompletedArtifactDirectorySync(join(root, 'artifact'), entries, manifest)
// Test-only external ledger/barrier, outside both native critical stacks.
writeFileSync(join(root, 'receipt.json'), JSON.stringify(prepared.receipt))
const go = new Promise<void>(resolve => process.stdin.once('data', () => resolve()))
// eslint-disable-next-line no-console
console.log('READY')
await go
const completed = prepared.publishSync()
// eslint-disable-next-line no-console
console.log('COMPLETED', JSON.stringify(completed))
