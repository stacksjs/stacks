import { expect, test } from 'bun:test'
import { closeSync, mkdirSync, mkdtempSync, openSync, readSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, parse } from 'node:path'
import { inspectDirectoryMounts } from '../src/temporary-workspaces'

test('own-namespace mount inspection permits a canonical directory with an active reader', () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-directory-mounts-')))
  let fd: number | undefined
  try {
    const file = join(directory, 'held.bin')
    writeFileSync(file, new Uint8Array([17]), { mode: 0o600 })
    fd = openSync(file, 'r')
    expect(inspectDirectoryMounts(directory)).toEqual({ unmounted: true, reason: 'unmounted' })
    const byte = new Uint8Array(1)
    expect(readSync(fd, byte, 0, 1, 0)).toBe(1)
    expect(byte[0]).toBe(17)
  }
  finally { if (fd !== undefined) closeSync(fd); rmSync(directory, { recursive: true, force: true }) }
})

test('an actual filesystem root is reported mounted', () => {
  const root = realpathSync(parse(realpathSync(tmpdir())).root)
  expect(inspectDirectoryMounts(root)).toEqual({ unmounted: false, reason: 'mounted' })
})

test('missing, noncanonical, symlink and non-directory paths are unavailable, never unmounted', () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-directory-mounts-')))
  try {
    const child = join(directory, 'child')
    mkdirSync(child)
    writeFileSync(join(directory, 'file'), '')
    symlinkSync(child, join(directory, 'alias'))
    for (const path of [join(directory, 'missing'), join(directory, 'file'), join(directory, 'alias'), `${directory}/child/..`, '.', '', '\0']) {
      const result = inspectDirectoryMounts(path)
      expect(result.unmounted).toBe(false)
      expect(result.reason).toBe('inspection-unavailable')
      expect(result.operation).toBe('path')
    }
    let invoked = false
    const value = { toString() { invoked = true; return directory } }
    expect(inspectDirectoryMounts(value as never).unmounted).toBe(false)
    expect(invoked).toBe(false)
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
})
