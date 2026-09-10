import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { assertCapabilityAvailable, capabilityDrivers, capabilityRegistry, findCapability } from '../src/capabilities'

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
})
