import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { assertCapabilityAvailable, capabilityDrivers, capabilityRegistry, findCapability, isRemoteTopology } from '../src/capabilities'

/** The repository root, resolved from this file rather than the working directory. */
const root = join(import.meta.dir, '../../../../../')

describe('capability registry', () => {
  it('resolves operational drivers', () => {
    expect(assertCapabilityAvailable('database', 'sqlite').status).toBe('supported')
    expect(capabilityDrivers('queue').map(driver => driver.name)).toContain('redis')
  })

  it('fails loudly for unknown and unsupported drivers', () => {
    expect(() => assertCapabilityAvailable('queue', 'typo')).toThrow('Unknown queue driver')
    expect(() => assertCapabilityAvailable('queue', 'sqs')).toThrow('is unsupported')
    expect(findCapability('database', 'dynamodb')?.status).toBe('unsupported')
  })
})

/**
 * The registry is a set of claims about what is supported and what evidence
 * backs it (stacksjs/stacks#2056). A claim whose evidence has been deleted, or
 * a driver that exists and is not claimed at all, is the failure mode - and
 * both are silent, because nothing reads these strings at runtime.
 *
 * The `storage` category had already drifted when these were written: the Azure
 * adapter shipped in #1896 and no entry came with it, so the registry reported
 * four storage drivers where the package exports five.
 */
describe('the registry\'s claims are checkable', () => {
  it('cites an implementation file that exists', () => {
    const missing = capabilityRegistry
      .filter(driver => driver.implementation !== null && !existsSync(join(root, driver.implementation)))
      .map(driver => `${driver.category}/${driver.name}: ${driver.implementation}`)

    expect(missing).toEqual([])
  })

  it('cites test evidence that exists', () => {
    // A driver called `supported` on the strength of a test file that is no
    // longer there is the claim this catches.
    const missing = capabilityRegistry.flatMap(driver =>
      driver.testEvidence
        .filter(path => !existsSync(join(root, path)))
        .map(path => `${driver.category}/${driver.name}: ${path}`),
    )

    expect(missing).toEqual([])
  })

  it('gives anything short of supported a reason', () => {
    // `partial`, `experimental` and `unsupported` are judgements. Without a
    // limitation they read as an oversight rather than a decision, and nobody
    // can tell what would have to change to move the status.
    const unexplained = capabilityRegistry
      .filter(driver => driver.status !== 'supported' && driver.limitations.length === 0)
      .map(driver => `${driver.category}/${driver.name}`)

    expect(unexplained).toEqual([])
  })

  it('backs a live-service contract with the workflow that runs it', () => {
    for (const driver of capabilityRegistry) {
      if (!driver.liveServiceContract)
        continue
      expect(existsSync(join(root, driver.liveServiceContract.workflow))).toBeTrue()
      expect(driver.liveServiceContract.version.length).toBeGreaterThan(0)
    }
  })

  it('makes a supported REMOTE driver name the provider version it was proven against', () => {
    // "Redis works" is not a checkable claim. "Redis 8.8.0 works, and this
    // workflow proves it" is, and it is the difference between a matrix a
    // reader can act on and one they take on faith.
    //
    // Only `supported` and only remote: a local driver has no provider to
    // version, and a `partial` or `experimental` one is already saying its
    // evidence is incomplete.
    const unversioned = capabilityRegistry
      .filter(driver => driver.status === 'supported' && isRemoteTopology(driver.topology) && !driver.liveServiceContract)
      .map(driver => `${driver.category}/${driver.name} (${driver.topology})`)

    expect(unversioned).toEqual([])
  })

  it('does not attach a live-service contract to a local driver', () => {
    // A version for something that runs in this process is a claim about
    // nothing, and it would make the matrix's version column mean two things.
    const misplaced = capabilityRegistry
      .filter(driver => driver.liveServiceContract && !isRemoteTopology(driver.topology))
      .map(driver => `${driver.category}/${driver.name} (${driver.topology})`)

    expect(misplaced).toEqual([])
  })

  it('names every driver at most once per category', () => {
    const keys = capabilityRegistry.map(driver => `${driver.category}/${driver.name}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('the registry covers the storage adapters that exist', () => {
  /**
   * Coverage asserted by PATH rather than by name, because the mapping from a
   * class to its config name is not mechanical - `AzureBlobStorageAdapter` is
   * configured as `azure`, `InMemoryStorageAdapter` as `memory`. The registry
   * already cites the implementation path, so that is the join key.
   *
   * Storage is the category checked here because its adapters are one file
   * each; the others resolve drivers behind a switch, where a file-based check
   * would be guesswork. It is also the category that drifted.
   */
  it('claims every adapter file in the storage package', () => {
    const dir = 'storage/framework/core/storage/src/adapters'
    const adapters = readdirSync(join(root, dir))
      .filter(file => file.endsWith('.ts') && file !== 'index.ts')
      // A wrapper around another adapter rather than a driver of its own: it
      // adds per-tenant prefix scoping and cannot be selected in config.
      .filter(file => file !== 'scoped.ts')
      .map(file => `${dir}/${file}`)

    const claimed = new Set(capabilityDrivers('storage').map(driver => driver.implementation))
    const unclaimed = adapters.filter(path => !claimed.has(path))

    expect(unclaimed).toEqual([])
  })

  /**
   * The same check for mail, which is also one file per driver.
   *
   * Extended here because the registry is the ALLOWLIST - `assertCapability
   * Available` refuses a driver that is not in it - so a driver shipping
   * without an entry is a driver nobody can configure. That is exactly how the
   * Azure storage adapter shipped in #1896, and there is no reason mail is
   * immune: it has seven drivers and gains one whenever a provider is added.
   *
   * Matched by NAME here rather than by path, because the mail registry cites
   * `drivers/<name>.ts` directly and the file name is the config name.
   */
  it('claims every driver file in the email package', () => {
    const dir = 'storage/framework/core/email/src/drivers'
    const drivers = readdirSync(join(root, dir))
      .filter(file => file.endsWith('.ts') && file !== 'index.ts')
      // The abstract base every driver extends, not a driver.
      .filter(file => file !== 'base.ts')
      .map(file => file.replace(/\.ts$/, ''))

    const claimed = new Set(capabilityDrivers('mail').map(driver => driver.name))
    const unclaimed = drivers.filter(name => !claimed.has(name))

    expect(unclaimed).toEqual([])
  })

  it('claims every driver file in the cache package', () => {
    const dir = 'storage/framework/core/cache/src/drivers'
    const drivers = readdirSync(join(root, dir))
      .filter(file => file.endsWith('.ts') && file !== 'index.ts')
      .map(file => file.replace(/\.ts$/, ''))

    const claimed = new Set(capabilityDrivers('cache').map(driver => driver.name))
    const unclaimed = drivers.filter(name => !claimed.has(name))

    expect(unclaimed).toEqual([])
  })
})
