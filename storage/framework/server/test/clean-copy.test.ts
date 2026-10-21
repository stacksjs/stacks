import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cleanCopy } from '../src/utils'

/**
 * `cleanCopy` replaces a directory of the server build with a fresh copy, and
 * a project may live under a path with a space in it. The command used to be
 * one string, which `runCommand` splits on whitespace without a shell, so
 * `rm -rf <base>/stacks build/target` removed `<base>/stacks` instead.
 */
const base = mkdtempSync(join(tmpdir(), 'stacks-clean-copy-'))
afterAll(() => rmSync(base, { recursive: true, force: true }))

describe('cleanCopy', () => {
  it('replaces the target and nothing else when the path holds a space', async () => {
    const source = join(base, 'source')
    mkdirSync(source)
    writeFileSync(join(source, 'fresh.txt'), 'fresh')

    // The directory whose name is the target path cut at its space.
    const sibling = join(base, 'stacks')
    mkdirSync(sibling)
    writeFileSync(join(sibling, 'keep.txt'), 'keep')

    const target = join(base, `stacks build-${process.pid}`, 'target')
    mkdirSync(target, { recursive: true })
    writeFileSync(join(target, 'stale.txt'), 'stale')

    await cleanCopy(source, target)

    expect(readFileSync(join(sibling, 'keep.txt'), 'utf8')).toBe('keep')
    expect(existsSync(join(target, 'stale.txt'))).toBe(false)
    expect(readFileSync(join(target, 'fresh.txt'), 'utf8')).toBe('fresh')
  })
})
