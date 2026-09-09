import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { cloudStatePath, ensureRuntimeDirectories, frameworkRuntimePath, mergeDirectoryInto, runtimeDirectoryEnv, stxPath } from '../src/index'

/**
 * Runtime state moved out of the project root and under `storage/`:
 *
 *   .stx       -> storage/framework/stx
 *   .ts-cloud  -> storage/cloud
 *   .stacks    -> storage/framework/runtime
 *
 * stx and ts-cloud read the new location from their own `stateDir` config
 * option, so nothing is left behind in the project root - no symlinks.
 *
 * `mergeDirectoryInto` is the one-time migration that carries an existing
 * project across. It has to be recursive: a shallow "move each top-level entry
 * unless it already exists" pass silently drops a whole subtree whenever a
 * single sibling inside it is already present at the destination, which is
 * exactly the shape of `.ts-cloud/state/` (one file per environment, and the
 * deploy command writes some of them to the new location already).
 */

let root: string

function scratch(): string {
  root = mkdtempSync(join(tmpdir(), 'stacks-runtime-dirs-'))
  return root
}

afterEach(() => {
  if (root)
    rmSync(root, { recursive: true, force: true })
})

describe('runtime directory paths', () => {
  it('resolves each relocated directory under storage/', () => {
    expect(stxPath()).toEndWith('/storage/framework/stx')
    expect(frameworkRuntimePath()).toEndWith('/storage/framework/runtime')
    expect(cloudStatePath()).toEndWith('/storage/cloud')
  })

  it('appends a sub-path without doubling separators', () => {
    expect(frameworkRuntimePath('migrations.lock')).toEndWith('/storage/framework/runtime/migrations.lock')
    expect(cloudStatePath('state/app-production.json')).toEndWith('/storage/cloud/state/app-production.json')
  })

  it('keeps cloud state separate from the committed cloud/ IaC directory', () => {
    expect(cloudStatePath()).toEndWith('/storage/cloud')
    expect(cloudStatePath('state')).not.toBe(`${cloudStatePath()}/../../cloud/state`)
  })
})

describe('runtimeDirectoryEnv', () => {
  /**
   * Both libraries read these ahead of their own config, which is what keeps a
   * process that never loads a config - and every process a command spawns -
   * writing to the same place.
   */
  it('names the variables stx and ts-cloud actually read', () => {
    expect(Object.keys(runtimeDirectoryEnv()).sort()).toEqual(['STX_DIR', 'TS_CLOUD_STATE_DIR'])
  })

  it('points each at its directory under storage/', () => {
    expect(runtimeDirectoryEnv().STX_DIR).toBe(stxPath().replace(/\/$/, ''))
    expect(runtimeDirectoryEnv().TS_CLOUD_STATE_DIR).toBe(cloudStatePath().replace(/\/$/, ''))
  })

  /**
   * Absolute, and with no trailing slash: a relative value would resolve
   * against whatever directory a given call site happens to use, and stx joins
   * the value onto sub-paths itself.
   */
  it('exports absolute paths with no trailing separator', () => {
    for (const value of Object.values(runtimeDirectoryEnv())) {
      expect(value.startsWith('/')).toBeTrue()
      expect(value.endsWith('/')).toBeFalse()
    }
  })
})

describe('mergeDirectoryInto', () => {
  it('moves entries that do not exist at the destination', () => {
    const dir = scratch()
    mkdirSync(join(dir, 'from'), { recursive: true })
    writeFileSync(join(dir, 'from', 'secret'), 'value')

    mergeDirectoryInto(join(dir, 'from'), join(dir, 'to'))

    expect(readFileSync(join(dir, 'to', 'secret'), 'utf8')).toBe('value')
    expect(existsSync(join(dir, 'from', 'secret'))).toBeFalse()
  })

  it('creates the destination when it does not exist yet', () => {
    const dir = scratch()
    mkdirSync(join(dir, 'from'), { recursive: true })

    mergeDirectoryInto(join(dir, 'from'), join(dir, 'to'))

    expect(existsSync(join(dir, 'to'))).toBeTrue()
  })

  it('lets the destination win when both sides have the same file', () => {
    const dir = scratch()
    mkdirSync(join(dir, 'from'), { recursive: true })
    mkdirSync(join(dir, 'to'), { recursive: true })
    writeFileSync(join(dir, 'from', 'state.json'), 'old')
    writeFileSync(join(dir, 'to', 'state.json'), 'new')

    mergeDirectoryInto(join(dir, 'from'), join(dir, 'to'))

    expect(readFileSync(join(dir, 'to', 'state.json'), 'utf8')).toBe('new')
  })

  it('merges shared directories instead of discarding the whole subtree', () => {
    const dir = scratch()
    mkdirSync(join(dir, 'from', 'state'), { recursive: true })
    mkdirSync(join(dir, 'to', 'state'), { recursive: true })
    writeFileSync(join(dir, 'from', 'state', 'production.json'), 'old-production')
    writeFileSync(join(dir, 'from', 'state', 'staging.json'), 'staging')
    writeFileSync(join(dir, 'to', 'state', 'production.json'), 'new-production')

    mergeDirectoryInto(join(dir, 'from'), join(dir, 'to'))

    // The destination wins for the file both sides have...
    expect(readFileSync(join(dir, 'to', 'state', 'production.json'), 'utf8')).toBe('new-production')
    // ...and the sibling that only the source had still has to survive.
    expect(readFileSync(join(dir, 'to', 'state', 'staging.json'), 'utf8')).toBe('staging')
  })

  it('merges arbitrarily deep trees', () => {
    const dir = scratch()
    mkdirSync(join(dir, 'from', 'cache', 'templates', 'nested'), { recursive: true })
    mkdirSync(join(dir, 'to', 'cache', 'templates'), { recursive: true })
    writeFileSync(join(dir, 'from', 'cache', 'templates', 'nested', 'deep.json'), 'deep')
    writeFileSync(join(dir, 'to', 'cache', 'keep.json'), 'keep')

    mergeDirectoryInto(join(dir, 'from'), join(dir, 'to'))

    expect(readFileSync(join(dir, 'to', 'cache', 'templates', 'nested', 'deep.json'), 'utf8')).toBe('deep')
    expect(readFileSync(join(dir, 'to', 'cache', 'keep.json'), 'utf8')).toBe('keep')
  })

  it('drops the source when a name is a directory on one side and a file on the other', () => {
    const dir = scratch()
    mkdirSync(join(dir, 'from', 'state'), { recursive: true })
    mkdirSync(join(dir, 'to'), { recursive: true })
    writeFileSync(join(dir, 'from', 'state', 'a.json'), 'a')
    writeFileSync(join(dir, 'to', 'state'), 'a plain file')

    mergeDirectoryInto(join(dir, 'from'), join(dir, 'to'))

    expect(readFileSync(join(dir, 'to', 'state'), 'utf8')).toBe('a plain file')
    expect(existsSync(join(dir, 'from', 'state'))).toBeFalse()
  })

  it('leaves the source empty so the caller can remove it', () => {
    const dir = scratch()
    mkdirSync(join(dir, 'from', 'a', 'b'), { recursive: true })
    writeFileSync(join(dir, 'from', 'a', 'b', 'c.json'), 'c')

    mergeDirectoryInto(join(dir, 'from'), join(dir, 'to'))
    rmSync(join(dir, 'from'), { recursive: true, force: true })

    expect(existsSync(join(dir, 'from'))).toBeFalse()
    expect(readFileSync(join(dir, 'to', 'a', 'b', 'c.json'), 'utf8')).toBe('c')
  })

  it('carries a symlinked entry over rather than following it', () => {
    const dir = scratch()
    mkdirSync(join(dir, 'from'), { recursive: true })
    writeFileSync(join(dir, 'target.json'), 'target')
    symlinkSync(join(dir, 'target.json'), join(dir, 'from', 'link.json'))

    mergeDirectoryInto(join(dir, 'from'), join(dir, 'to'))

    expect(readFileSync(join(dir, 'to', 'link.json'), 'utf8')).toBe('target')
    expect(readFileSync(join(dir, 'target.json'), 'utf8')).toBe('target')
  })
})

/**
 * The migration itself, which had no direct coverage - which is how it came to
 * create three directories in whatever directory a command was invoked from,
 * including read-only ones, and including when that directory was not a Stacks
 * project at all (stacksjs/stacks#2576).
 *
 * Driven by `process.chdir`, because `projectPath()` derives the root from the
 * current directory and there is no override. Restored in a `finally` so one
 * failure cannot leak the cwd into every test after it.
 */
describe('ensureRuntimeDirectories', () => {
  function inProject<T>(run: (root: string) => T): T {
    const previous = process.cwd()
    scratch()
    try {
      process.chdir(root)
      // The realpath, not the path we chdir'd to. On macOS `/var` is a symlink
      // to `/private/var`, so `mkdtemp` hands back a path that `process.cwd()`
      // - and therefore `projectPath()` - spells differently. Comparing the two
      // spellings is a test bug that reads exactly like a product one.
      return run(process.cwd())
    }
    finally {
      process.chdir(previous)
    }
  }

  it('creates nothing when there is nothing to migrate', () => {
    inProject((root) => {
      const results = ensureRuntimeDirectories()

      // Every legacy path is absent, so every one is already "cleared" - and
      // nothing has been written, because a directory nobody has written to
      // does not need to exist. stx and ts-cloud create their own on first use.
      expect(results.every(entry => entry.cleared)).toBe(true)
      expect(existsSync(join(root, 'storage'))).toBe(false)
    })
  })

  it('creates the target and moves the contents when a legacy directory is there', () => {
    inProject((root) => {
      mkdirSync(join(root, '.stx/cache'), { recursive: true })
      writeFileSync(join(root, '.stx/cache/page.js'), 'compiled')

      const results = ensureRuntimeDirectories()

      expect(results.find(entry => entry.legacy.endsWith('/.stx'))?.cleared).toBe(true)
      expect(readFileSync(join(root, 'storage/framework/stx/cache/page.js'), 'utf8')).toBe('compiled')
      expect(existsSync(join(root, '.stx'))).toBe(false)
    })
  })

  it('removes a symlink that already points at the target', () => {
    inProject((root) => {
      mkdirSync(join(root, 'storage/framework/stx'), { recursive: true })
      symlinkSync(join(root, 'storage/framework/stx'), join(root, '.stx'))

      expect(ensureRuntimeDirectories().find(entry => entry.legacy.endsWith('/.stx'))?.cleared).toBe(true)
      expect(existsSync(join(root, '.stx'))).toBe(false)
      expect(existsSync(join(root, 'storage/framework/stx'))).toBe(true)
    })
  })

  it('leaves a symlink pointing somewhere else alone, and says so', () => {
    inProject((root) => {
      // An old checkout's `.stacks` may still be the core-source shortcut, which
      // is not ours to remove.
      mkdirSync(join(root, 'elsewhere'), { recursive: true })
      symlinkSync(join(root, 'elsewhere'), join(root, '.stacks'))

      expect(ensureRuntimeDirectories().find(entry => entry.legacy.endsWith('/.stacks'))?.cleared).toBe(false)
      expect(existsSync(join(root, '.stacks'))).toBe(true)
    })
  })

  it('clears a stray file sitting where a directory belongs', () => {
    inProject((root) => {
      writeFileSync(join(root, '.ts-cloud'), 'not a directory')

      expect(ensureRuntimeDirectories().find(entry => entry.legacy.endsWith('/.ts-cloud'))?.cleared).toBe(true)
      expect(existsSync(join(root, '.ts-cloud'))).toBe(false)
    })
  })

  it('is idempotent, and the second run still writes nothing', () => {
    inProject((root) => {
      mkdirSync(join(root, '.stx'), { recursive: true })
      writeFileSync(join(root, '.stx/one.txt'), 'x')

      ensureRuntimeDirectories()
      const second = ensureRuntimeDirectories()

      expect(second.every(entry => entry.cleared)).toBe(true)
      expect(readFileSync(join(root, 'storage/framework/stx/one.txt'), 'utf8')).toBe('x')
      // The two it did not have to migrate are still absent.
      expect(existsSync(join(root, 'storage/cloud'))).toBe(false)
      expect(existsSync(join(root, 'storage/framework/runtime'))).toBe(false)
    })
  })
})
