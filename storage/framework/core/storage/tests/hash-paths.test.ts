/**
 * `hashPaths()` changes when the tree changes, and only then.
 *
 * It hashed file contents alone, concatenated in `readdir` order. Renaming or
 * moving a file left the hash unchanged - and `websiteSourceHash()`, built on
 * it, decides whether a deploy has anything new - while the same tree hashed
 * differently on filesystems that list a directory in different orders.
 */

import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { hashPath, hashPaths } from '../src/hash'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-hash-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function tree(at: string, files: Record<string, string>): string {
  for (const [name, contents] of Object.entries(files)) {
    mkdirSync(join(at, name, '..'), { recursive: true })
    writeFileSync(join(at, name), contents)
  }
  return at
}

describe('hashPaths', () => {
  test('renaming a file changes the hash', () => {
    const site = tree(join(root, 'site'), { 'views/home.stx': '<h1>Hi</h1>' })
    const before = hashPath(site)
    renameSync(join(site, 'views/home.stx'), join(site, 'views/index.stx'))
    expect(hashPath(site)).not.toBe(before)
  })

  test('moving bytes between files changes the hash', () => {
    // Concatenated in either order, both are 'aaa'.
    const a = tree(join(root, 'a'), { 'a.txt': 'aa', 'b.txt': 'a' })
    const b = tree(join(root, 'b'), { 'a.txt': 'a', 'b.txt': 'aa' })
    expect(hashPath(a)).not.toBe(hashPath(b))
  })

  test('an empty directory appearing changes the hash', () => {
    const site = tree(join(root, 'site'), { 'a.txt': 'x' })
    const before = hashPath(site)
    mkdirSync(join(site, 'empty'))
    expect(hashPath(site)).not.toBe(before)
  })

  test('the same tree hashes the same wherever it sits, whatever order it was written in', () => {
    const one = tree(join(root, 'one'), { 'b/2.txt': 'two', 'a/1.txt': 'one', 'c.txt': 'three' })
    const two = tree(join(root, 'elsewhere', 'two'), { 'c.txt': 'three', 'a/1.txt': 'one', 'b/2.txt': 'two' })
    expect(hashPath(one)).toBe(hashPath(two))
  })

  test('a missing path is hashed as missing, so creating it changes the hash', () => {
    const missing = join(root, 'not-yet')
    const before = hashPaths([missing])
    tree(missing, { 'x.txt': 'x' })
    expect(hashPaths([missing])).not.toBe(before)
  })

  test('a symlink is hashed as its target, and a link back up the tree does not recurse', () => {
    const site = tree(join(root, 'site'), { 'a.txt': 'x' })
    symlinkSync('..', join(site, 'parent'))
    const withLink = hashPath(site)
    expect(withLink).toMatch(/^[0-9a-f]{64}$/)

    rmSync(join(site, 'parent'))
    symlinkSync('.', join(site, 'parent'))
    expect(hashPath(site)).not.toBe(withLink)
  })

  test('which root a file is under counts', () => {
    const a = tree(join(root, 'a'), { 'x.txt': 'x' })
    const b = join(root, 'b')
    mkdirSync(b)
    const before = hashPaths([a, b])
    renameSync(join(a, 'x.txt'), join(b, 'x.txt'))
    expect(hashPaths([a, b])).not.toBe(before)
  })
})
