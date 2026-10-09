/**
 * Recognising a `bun build --compile` binary (stacksjs/stacks#2886).
 *
 * `loadUserlandModel` probes the filesystem for a model, resolving the project
 * root by walking up from the CWD. In a compiled desktop binary that finds
 * whatever project it happens to be launched from: run from a Stacks project
 * root it located that project's `storage/framework/defaults/app/Models/*.ts`,
 * tried to import them, and failed on `Cannot find module '@stacksjs/orm'` once
 * per model - 36 warnings for models the app does not use. Run from `/tmp` it
 * found nothing and said nothing. Same binary, same arguments.
 *
 * The probe can never succeed inside a binary. A `.ts` file loaded off disk by
 * a dynamic import resolves its OWN imports from disk, so either
 * `@stacksjs/orm` is not there (the reported failure) or it is, and the model
 * binds against a second copy of the ORM rather than the bundled one - which
 * would be worse than failing. Finding a foreign project's sources at all is
 * the bug.
 *
 * The marker values here were read off a real compiled binary rather than
 * taken from documentation; see the `/$bunfs/` cases.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isCompiledBinary } from '../src/utils/compiled-binary'

describe('isCompiledBinary', () => {
  it('recognises the virtual root a compiled binary runs from', () => {
    // Verified by compiling a probe: inside the binary `Bun.main` is
    // `/$bunfs/root/probe` and `import.meta.dir` is `/$bunfs/root`, while the
    // same file run as a script reports its real path.
    expect(isCompiledBinary('/$bunfs/root/probe')).toBe(true)
    expect(isCompiledBinary('/$bunfs/root/nested/entry.ts')).toBe(true)
  })

  it('recognises the Windows form, which Bun spells differently', () => {
    // Bun mounts the bundle at `B:\~BUN\root` there. Both separators, since a
    // path can reach this having been normalised either way.
    expect(isCompiledBinary('B:\\~BUN\\root\\app.exe')).toBe(true)
    expect(isCompiledBinary('B:/~BUN/root/app.exe')).toBe(true)
  })

  it('says no for an ordinary script, which is the common case', () => {
    for (const main of [
      '/Users/me/Projects/app/server.ts',
      '/Users/me/Projects/app/node_modules/@stacksjs/orm/src/index.ts',
      'C:\\Users\\me\\app\\server.ts',
      '/tmp/probe.ts',
    ])
      expect(isCompiledBinary(main), main).toBe(false)
  })

  it('is not fooled by a directory that merely contains the marker text', () => {
    // A path component has to BE the marker, not contain it, or a project
    // called `my-$bunfs-notes` would disable model loading for itself.
    for (const main of [
      '/Users/me/Projects/my-$bunfs-thing/server.ts',
      '/Users/me/bunfs/root/server.ts',
      '/Users/me/~BUNDLE/root/server.ts',
      '/Users/me/projects/$bunfsx/server.ts',
    ])
      expect(isCompiledBinary(main), main).toBe(false)
  })

  it('treats a missing or empty entrypoint as not compiled', () => {
    // Fail toward the behaviour every non-binary has, so a runtime that stops
    // reporting `Bun.main` does not silently stop loading models.
    for (const main of ['', undefined as unknown as string, null as unknown as string])
      expect(isCompiledBinary(main)).toBe(false)
  })

  it('defaults to this process, which under bun test is a real file', () => {
    expect(isCompiledBinary()).toBe(false)
  })
})

/**
 * That the probe consults it.
 *
 * `loadUserlandModel` is module-private, and importing `src/index.ts` to reach
 * it would run the deferred warmup that loads every framework model. So the
 * wiring is asserted against the source, as the sibling generator mirrors are.
 *
 * Verified on the real artifact first, which is what these assertions stand in
 * for: a compiled binary built from this checkout and run from the project root
 * logged 63 `[orm] Failed to import framework default model` lines without the
 * guard and 0 with it, from the same build command.
 */
describe('the model probe', () => {
  const index = readFileSync(join(import.meta.dir, '..', 'src', 'index.ts'), 'utf8')

  /** The index of `needle`, asserting it is there. */
  function indexOfExisting(needle: string, from = 0): number {
    const at = index.indexOf(needle, from)
    expect(at, `missing from orm/src/index.ts after ${from}: ${needle}`).toBeGreaterThan(-1)
    return at
  }

  it('checks for a compiled binary before touching the filesystem', () => {
    // Ahead of the `@stacksjs/path` import that resolves the project root from
    // the CWD, or it has already decided which project to read.
    const guard = indexOfExisting('if (isCompiledBinary()) {')
    const resolvesRoot = indexOfExisting(`const { path } = await import('@stacksjs/path')`)

    expect(guard).toBeLessThan(resolvesRoot)
  })

  it('returns null rather than throwing, which is the found-nothing path', () => {
    // The app already works this way: run from a directory with no
    // `storage/framework/defaults`, the probe finds nothing, returns null and
    // the binary serves fine. The guard reuses that path rather than inventing
    // a new one.
    const guard = indexOfExisting('if (isCompiledBinary()) {')
    const returns = indexOfExisting('return null', guard)

    expect(returns).toBeLessThan(indexOfExisting(`const { path } = await import('@stacksjs/path')`))
  })

  it('says so once, not once per model', () => {
    // 36 identical lines is how a warning stops being read, and the count
    // tracks the enabled features rather than anything the reader did.
    expect(index).toContain('announcedCompiledSkip')

    const guard = indexOfExisting('if (isCompiledBinary()) {')
    const flagSet = indexOfExisting('announcedCompiledSkip = true', guard)
    const logged = indexOfExisting('console.debug(', guard)

    expect(flagSet).toBeLessThan(logged)
  })

  it('imports the helper after the binding-order priming import', () => {
    // That import has to evaluate first or user models see `schema` in TDZ;
    // its own comment explains why. Anything added above it breaks that.
    expect(indexOfExisting(`import '@stacksjs/validation/runtime'`))
      .toBeLessThan(indexOfExisting(`import { isCompiledBinary } from './utils/compiled-binary'`))
  })
})
