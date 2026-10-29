import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFileIfChanged } from '../src/dev/dashboard-utils'

/**
 * The dashboard's models manifest is rewritten on every boot and is an input
 * of the kept render cache, so identical content must not move its mtime
 * (stacksjs/stacks#3035).
 */

const dir = mkdtempSync(join(tmpdir(), 'dashboard-manifest-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('writeFileIfChanged', () => {
  it('writes a file that is not there yet', () => {
    const file = join(dir, 'new.json')
    expect(writeFileIfChanged(file, '{"a":1}')).toBe(true)
    expect(readFileSync(file, 'utf8')).toBe('{"a":1}')
  })

  it('leaves identical content alone, mtime included', () => {
    const file = join(dir, 'same.json')
    writeFileIfChanged(file, '{"a":1}')
    // An old mtime, so a rewrite would be unmistakable.
    const old = new Date('2020-01-01T00:00:00Z')
    utimesSync(file, old, old)

    expect(writeFileIfChanged(file, '{"a":1}')).toBe(false)
    expect(statSync(file).mtimeMs).toBe(old.getTime())
  })

  it('writes content that changed, and leaves no temporary file behind', () => {
    const file = join(dir, 'changed.json')
    writeFileIfChanged(file, '{"a":1}')
    expect(writeFileIfChanged(file, '{"a":2}')).toBe(true)
    expect(readFileSync(file, 'utf8')).toBe('{"a":2}')
    expect(readdirSync(dir).filter(name => name.endsWith('.tmp'))).toEqual([])
  })
})
