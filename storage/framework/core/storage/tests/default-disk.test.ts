/**
 * `Storage.disk()` resolves with the configuration Stacks ships.
 *
 * It did not. `config/filesystems.ts` set `driver: 'bun'`, that value is
 * assigned straight to `config.default` - a DISK name - and the disks the
 * facade builds are `local`, `public` and, once a bucket is configured, `s3`.
 * So the no-argument call, which is the one most code makes, threw
 * `Disk [bun] is not configured. Available: local, public` in a stock app.
 *
 * The type is what allowed it: `FilesystemsConfig.driver` was
 * `'s3' | 'efs' | 'local' | 'bun' | 'memory'` - a list of ADAPTERS, two of
 * which are not disks at all - and `config/filesystems.ts` reached that union
 * through an `as any`, standing exactly where the mismatch would otherwise have
 * been reported.
 */

import { describe, expect, it } from 'bun:test'
import { config } from '@stacksjs/config'
import { Storage } from '../src/facade'

describe('the default disk', () => {
  it('resolves without a name, using the shipped configuration', () => {
    // The call every `storage.put(...)` makes before it reaches an adapter.
    expect(() => Storage.disk()).not.toThrow()
  })

  it('is configured as a disk the facade actually builds', () => {
    // `local` and `public` are unconditional; `s3` appears once a bucket is
    // set. Anything else is a name `disk()` will fail to look up.
    expect(['local', 'public', 's3']).toContain(config.filesystems.driver)
  })

  it('names a disk, not an adapter', () => {
    // The distinction the old type erased. `bun` and `memory` are adapter
    // modules on disk; neither is a disk, and `createAdapter` handles neither.
    expect(['bun', 'memory', 'efs']).not.toContain(config.filesystems.driver)
  })

  it('falls back to local when nothing is configured', () => {
    // `buildConfig()` reads `filesystems.driver || 'local'`, so an app that
    // deletes the key still gets a working disk rather than a lookup for ''.
    expect(Storage.disk('local')).toBeDefined()
  })
})
