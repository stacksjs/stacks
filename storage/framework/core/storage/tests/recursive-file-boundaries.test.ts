import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync, lstatSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deleteFiles, getFiles } from '../src/files'

test('recursive helpers never traverse symlinks into sibling directories or cycles', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'stacks-file-boundary-'))
  const inside = join(fixture, 'inside'), outside = join(fixture, 'outside')
  mkdirSync(inside); mkdirSync(outside)
  writeFileSync(join(outside, 'keep.txt'), 'external')
  writeFileSync(join(inside, 'local.txt'), 'local')
  symlinkSync(outside, join(inside, 'linked'), 'dir')
  symlinkSync(inside, join(inside, 'cycle'), 'dir')
  symlinkSync(join(fixture, 'missing'), join(inside, 'dangling'))
  try {
    expect(getFiles(inside)).toEqual([join(inside, 'local.txt')])
    deleteFiles(inside)
    expect(readFileSync(join(outside, 'keep.txt'), 'utf8')).toBe('external')
    expect(existsSync(join(inside, 'local.txt'))).toBe(false)
    expect(() => lstatSync(join(inside, 'dangling'))).toThrow()
    expect(existsSync(join(inside, 'linked'))).toBe(false)
    expect(existsSync(join(inside, 'cycle'))).toBe(false)
  }
  finally { rmSync(fixture, { recursive: true, force: true }) }
})

test('recursive deletion unlinks an explicit symlink root and honors exclusions', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'stacks-file-exclusions-'))
  const folder = join(fixture, 'folder'), link = join(fixture, 'link')
  mkdirSync(folder); writeFileSync(join(folder, 'keep.txt'), 'keep'); writeFileSync(join(folder, 'remove.txt'), 'remove')
  symlinkSync(folder, link, 'dir')
  try {
    deleteFiles(link)
    expect(existsSync(link)).toBe(false)
    expect(readFileSync(join(folder, 'keep.txt'), 'utf8')).toBe('keep')
    deleteFiles(folder, ['keep.txt'])
    expect(getFiles(folder)).toEqual([join(folder, 'keep.txt')])
  }
  finally { rmSync(fixture, { recursive: true, force: true }) }
})


test('explicit symlink roots, trailing separators and aliased ancestors cannot escape', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'stacks-file-roots-'))
  const outside = join(fixture, 'outside'), link = join(fixture, 'link')
  mkdirSync(join(outside, 'sub'), { recursive: true })
  writeFileSync(join(outside, 'sub/keep.txt'), 'external')
  try {
    symlinkSync(outside, link, 'dir')
    expect(getFiles(link + '/')).toEqual([])
    expect(() => getFiles(join(link, 'sub'))).toThrow('symlink ancestor')
    expect(() => deleteFiles(join(link, 'sub'))).toThrow('symlink ancestor')
    deleteFiles(link + '/')
    expect(existsSync(link)).toBe(false)
    expect(readFileSync(join(outside, 'sub/keep.txt'), 'utf8')).toBe('external')
  }
  finally { rmSync(fixture, { recursive: true, force: true }) }
})


test.skipIf(process.platform === 'win32')('POSIX temp aliases remain usable without following links beneath them', () => {
  const fixture = mkdtempSync('/tmp/stacks-file-system-temp-')
  try {
    writeFileSync(join(fixture, 'local.txt'), 'local')
    expect(getFiles(fixture)).toEqual([join(fixture, 'local.txt')])
    deleteFiles(fixture)
    expect(existsSync(join(fixture, 'local.txt'))).toBe(false)
  }
  finally { rmSync(fixture, { recursive: true, force: true }) }
})
