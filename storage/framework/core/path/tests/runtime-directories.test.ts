import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cloudStatePath, frameworkRuntimePath, mergeDirectoryInto, stxPath } from '../src/index'

/**
 * Runtime state moved out of the project root and under `storage/`:
 *
 *   .stx       -> storage/framework/stx
 *   .ts-cloud  -> storage/cloud
 *   .stacks    -> storage/framework/runtime
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
