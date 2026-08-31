import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { BUN_EXECUTABLE_MARKER, describeRuntimeDuplication, looksLikeBunExecutable } from '../src/index'

/**
 * What a desktop bundle pays for each compiled binary it ships.
 *
 * `bun build --compile` embeds the whole Bun runtime in every executable it
 * writes: `console.log("hi")` measures 60.5 MB. An app that splits its
 * launcher, its agent and a worker into three binaries therefore ships three
 * copies of the same runtime — about 180 MB — and nothing anywhere says so. The
 * bundle is simply large, and a large desktop app looks unremarkable. One real
 * app carried 230 MB that way, of which its own code and the native Craft
 * runtime together were under 40 MB.
 *
 * So the build warns. These are the two pieces it warns from.
 */

describe('looksLikeBunExecutable', () => {
  const fake = (size: number, tail: string) => () => ({ size, tail })

  test('recognises a compiled binary by its trailer', () => {
    expect(looksLikeBunExecutable('x', fake(80 * 1024 * 1024, `padding${BUN_EXECUTABLE_MARKER}more`))).toBe(true)
  })

  test('a native binary of the same size is not one', () => {
    // craft-runtime is 13 MB of real Mach-O and must never be counted as a
    // duplicated runtime — it is the one thing in the bundle that has to exist.
    expect(looksLikeBunExecutable('x', fake(80 * 1024 * 1024, 'no marker here'))).toBe(false)
  })

  test('ignores anything too small to be a runtime, without reading it', () => {
    // The marker check is skipped below the floor, so a small file carrying the
    // string by coincidence — a script, a manifest — cannot trip the warning.
    expect(looksLikeBunExecutable('x', fake(2 * 1024, BUN_EXECUTABLE_MARKER))).toBe(false)
  })

  test('an unreadable path is not a runtime', () => {
    expect(looksLikeBunExecutable('x', () => null)).toBe(false)
  })
})

describe('describeRuntimeDuplication', () => {
  test('says nothing about a bundle with one compiled binary', () => {
    // The expected shape. A single runtime is not waste; it is the price.
    expect(describeRuntimeDuplication([{ name: 'MyApp', bytes: 83 * 1024 * 1024 }])).toBeNull()
    expect(describeRuntimeDuplication([])).toBeNull()
  })

  test('names every binary and what the repetition costs', () => {
    const message = describeRuntimeDuplication([
      { name: 'MyApp', bytes: 83 * 1024 * 1024 },
      { name: 'myapp-agent', bytes: 83 * 1024 * 1024 },
      { name: 'myapp-worker', bytes: 60 * 1024 * 1024 },
    ])

    expect(message).toContain('3 Bun-compiled executables')
    expect(message).toContain('myapp-agent')
    expect(message).toContain('80 MB')
    // The fix belongs in the warning: someone reading this is looking at a
    // large bundle and has no reason to guess that subcommands are the answer.
    expect(message).toContain('subcommand')
  })

  test('charges only the copies after the first', () => {
    const two = describeRuntimeDuplication([
      { name: 'a', bytes: 80 * 1024 * 1024 },
      { name: 'b', bytes: 80 * 1024 * 1024 },
    ])
    expect(two).toContain('40 MB')
  })
})

describe('against a real bundle, when one is installed', () => {
  const app = join(homedir(), 'Applications/SystemCleaner.app/Contents/MacOS')
  const bunBinary = join(app, 'SystemCleaner')
  const nativeBinary = join(app, 'craft-runtime')
  const installed = existsSync(bunBinary) && existsSync(nativeBinary)

  test.skipIf(!installed)('tells a Bun executable from the native Craft runtime', () => {
    expect(looksLikeBunExecutable(bunBinary)).toBe(true)
    expect(looksLikeBunExecutable(nativeBinary)).toBe(false)
  })
})
