import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const mode = Bun.argv[2]
assert(['registry', 'response', 'incompatible'].includes(mode!))
const directory = await mkdtemp(join(tmpdir(), 'stacks-gate-bundles-'))
const entry = Bun.argv[3] ?? 'source'
assert(['source', 'dist'].includes(entry))
const gate = resolve(import.meta.dir, entry === 'dist' ? '../../dist/gate.js' : '../../src/gate.ts')
async function main() {
  try {
    const a = join(directory, 'bootstrap.ts'), b = join(directory, 'action.ts')
    for (const file of [a, b]) await Bun.write(file, `export * from ${JSON.stringify(gate)}\n`)
    // The normal native app build bundles each Action independently.
    const built = await Bun.build({ root: directory, entrypoints: [a, b], outdir: join(directory, 'dist'), target: 'bun', format: 'esm', splitting: false })
    assert.equal(built.success, true, built.logs.map(String).join('\n'))
    if (mode === 'incompatible') {
      const key = Symbol.for('@stacksjs/auth:gate-process-state')
      const valid = () => ({ version: 1, gates: new Map(), policies: new Map(), beforeCallbacks: [], afterCallbacks: [], responses: new WeakSet() })
      let touched = false
      const accessor = Object.defineProperty(valid(), 'version', { get() { touched = true; return 1 } })
      const callbackAccessor = Object.defineProperty([], '0', { get() { touched = true; return () => true } })
      const cases = [null, { ...valid(), version: 2 }, { ...valid(), gates: {} }, { ...valid(), responses: {} }, { ...valid(), beforeCallbacks: ['invalid'] }, { ...valid(), beforeCallbacks: callbackAccessor }, accessor]
      for (const [index, value] of cases.entries()) {
        Object.defineProperty(globalThis, key, { value, configurable: true })
        await assert.rejects(import(`${join(directory, 'dist/bootstrap.js')}?invalid=${index}`), /Incompatible shared Gate process state/)
        Reflect.deleteProperty(globalThis, key)
      }
      Object.defineProperty(globalThis, key, { get() { touched = true; return valid() }, configurable: true })
      await assert.rejects(import(`${join(directory, 'dist/bootstrap.js')}?invalid=property`), /Incompatible shared Gate process state/)
      Reflect.deleteProperty(globalThis, key)
      assert.equal(touched, false, 'incompatible process metadata must not invoke accessors')
      console.log('gate bundles incompatible passed')
      return
    }
    const bootstrap = await import(join(directory, 'dist/bootstrap.js'))
    const action = await import(join(directory, 'dist/action.js'))
    assert.notEqual(bootstrap.AuthorizationResponse, action.AuthorizationResponse)
    bootstrap.Gate.flush()
    if (mode === 'registry') {
      bootstrap.Gate.define('bundle-allow', () => true)
      assert.equal(action.Gate.has('bundle-allow'), true, 'bootstrap registrations must reach the bundled Action')
      assert.equal(await action.Gate.allows('bundle-allow', null), true)
      bootstrap.Gate.policy('Document', class { view() { return true } })
      assert.equal(action.Gate.hasPolicy('Document'), true)
      assert.equal(await action.Gate.allowsFor('Document', 'view', null), true)
      bootstrap.Gate.before((user: unknown, ability: string) => { void user; return ability === 'before-allow' ? true : null })
      assert.equal(await action.Gate.allows('before-allow', null), true)
      bootstrap.Gate.after((user: unknown, ability: string) => { void user; return ability === 'bundle-allow' ? false : null })
      assert.equal(await action.Gate.allows('bundle-allow', null), false)
      action.Gate.flush()
      assert.deepEqual(bootstrap.Gate.abilities(), [])
      assert.equal(bootstrap.Gate.hasPolicy('Document'), false)
      assert.equal(await bootstrap.Gate.allows('before-allow', null), false)
      bootstrap.Gate.define('bundle-allow', () => true)
      assert.equal(await action.Gate.allows('bundle-allow', null), true, 'flush removes shared after callbacks')
      bootstrap.Gate.define('after-flush', () => true)
      assert.equal(await action.Gate.allows('after-flush', null), true)
      action.Gate.flush()
    }
    else {
      // Register in the consuming copy so this isolates response normalization
      // even before the independent registry issue is corrected.
      const denied = bootstrap.AuthorizationResponse.deny('Denied by bootstrap', 'BOOTSTRAP_DENY')
      action.Gate.define('cross-response', () => denied)
      const inspected = await action.Gate.inspect('cross-response', null)
      assert.equal(inspected.isAllowed, false)
      assert.equal(inspected.message, 'Denied by bootstrap')
      assert.equal(inspected.code, 'BOOTSTRAP_DENY')
      assert.equal(await action.Gate.allows('cross-response', null), false)
      action.Gate.define('cross-allow', () => bootstrap.AuthorizationResponse.allow('Allowed by bootstrap'))
      assert.equal(await action.Gate.allows('cross-allow', null), true)
      bootstrap.Gate.policy('ForeignResponse', class { view() { return denied } })
      assert.equal((await action.Gate.inspectFor('ForeignResponse', 'view', null)).code, 'BOOTSTRAP_DENY')
      for (const reserved of ['before', 'allow', 'deny', 'denyIf', 'denyUnless', 'allowIf', 'constructor'])
        assert.equal(await action.Gate.allowsFor('ForeignResponse', reserved, null), false)
      for (const result of [new bootstrap.AuthorizationResponse('true'), new Proxy(denied, {}), { isAllowed: true }, Object.create(bootstrap.AuthorizationResponse.prototype), Object.create(action.AuthorizationResponse.prototype), 'truthy', 1, null]) {
        action.Gate.define('invalid', () => result)
        await assert.rejects(action.Gate.allows('invalid', null), TypeError)
      }
      let touched = false
      const accessor = Object.defineProperty({}, 'isAllowed', { get() { touched = true; return true } })
      action.Gate.define('accessor', () => accessor)
      await assert.rejects(action.Gate.allows('accessor', null), TypeError)
      assert.equal(touched, false)
      const changed = bootstrap.AuthorizationResponse.allow()
      Object.defineProperty(changed, 'isAllowed', { get() { touched = true; return true } })
      action.Gate.define('changed', () => changed)
      await assert.rejects(action.Gate.allows('changed', null), TypeError)
      assert.equal(touched, false)
      action.Gate.flush()
      action.Gate.define('after-flush-response', () => denied)
      assert.equal(await action.Gate.allows('after-flush-response', null), false)
      action.Gate.flush()
    }
    console.log(`gate bundles ${mode} passed`)
  }
  finally { await rm(directory, { recursive: true, force: true }) }
}
await main()
