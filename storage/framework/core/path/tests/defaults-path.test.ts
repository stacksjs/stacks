import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { clearDefaultsPathCache, defaultsPath, frameworkPath, resolveDefaultsRoot } from '../src/index'

/**
 * `defaultsPath()` is where the scaffold defaults resolve from.
 *
 * Every layer of the framework reads that tree by filesystem path, and all of
 * it currently goes through `frameworkPath('defaults/...')`, which hardcodes
 * `storage/framework/defaults` - a copy of `@stacksjs/defaults`, a package the
 * project already depends on. This is the single seam those callers move onto
 * so the vendored copy stops being load-bearing (stacksjs/stacks#2941).
 *
 * The behaviour that matters is that it prefers the vendored tree, so landing
 * it changes nothing for any project that has one, which is every project
 * today.
 */

/** A project root with the requested trees present. */
function fixture(has: { vendored?: boolean, installed?: boolean }): string {
  const root = mkdtempSync(join(tmpdir(), 'defaults-path-'))
  // `projectRootFor` anchors on storage/framework, so every fixture needs it
  // to be its own root rather than resolving to a parent of the temp dir.
  mkdirSync(join(root, 'storage/framework'), { recursive: true })

  if (has.vendored) {
    mkdirSync(join(root, 'storage/framework/defaults/app/Models'), { recursive: true })
    writeFileSync(join(root, 'storage/framework/defaults/app/Models/User.ts'), '// vendored\n')
  }
  if (has.installed) {
    mkdirSync(join(root, 'node_modules/@stacksjs/defaults/app/Models'), { recursive: true })
    writeFileSync(join(root, 'node_modules/@stacksjs/defaults/app/Models/User.ts'), '// installed\n')
  }

  return root
}

/** Resolve `path` with `cwd` as the project root. */
function resolveIn(root: string, path: string): string {
  const previous = process.cwd()
  process.chdir(root)
  clearDefaultsPathCache()
  try {
    return defaultsPath(path).replace(`${process.cwd()}/`, '')
  }
  finally {
    process.chdir(previous)
    clearDefaultsPathCache()
  }
}

describe('defaultsPath', () => {
  it('prefers the vendored tree, so this is a no-op for projects that have one', () => {
    const root = fixture({ vendored: true, installed: true })
    try {
      expect(resolveIn(root, 'app/Models/User.ts')).toBe('storage/framework/defaults/app/Models/User.ts')
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // The control. Without a case where the vendored tree is absent, the
  // assertion above is equally satisfied by a function that only ever returns
  // the vendored path, which is the thing this seam exists to stop being.
  it('falls back to the installed package when the tree is not vendored', () => {
    const root = fixture({ installed: true })
    try {
      expect(resolveIn(root, 'app/Models/User.ts')).toBe('node_modules/@stacksjs/defaults/app/Models/User.ts')
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('falls back to the module graph when the project has neither', () => {
    // Not a hole: a hoisted or linked layout legitimately puts the package
    // outside the project's own node_modules, and `import.meta.resolve` is
    // the only thing that knows where. Inside this repository that always
    // resolves, which is why the "nothing anywhere" branch is pinned on the
    // pure rule below rather than with a fixture.
    const root = fixture({})
    try {
      expect(resolveIn(root, 'app/Models/User.ts')).toContain('defaults/app/Models/User.ts')
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('decides on the root, not per file', () => {
    // A vendored tree that is missing one file must not make that one file
    // resolve out of the package. Two sources answering for one name, picked
    // per lookup, is the component-collision failure in #2927.
    const root = fixture({ vendored: true, installed: true })
    try {
      writeFileSync(join(root, 'node_modules/@stacksjs/defaults/app/Models/Only.ts'), '// installed only\n')
      expect(resolveIn(root, 'app/Models/Only.ts')).toBe('storage/framework/defaults/app/Models/Only.ts')
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('agrees with frameworkPath in this checkout', () => {
    // The framework repository vendors the tree, so the seam and the path it
    // replaces have to be the same string here, or landing it is not a no-op.
    expect(defaultsPath('app/Models/User.ts')).toBe(frameworkPath('defaults/app/Models/User.ts'))
    expect(defaultsPath()).toBe(frameworkPath('defaults'))
  })

  it('takes a relative option like the other path helpers', () => {
    expect(defaultsPath('app/Models', { relative: true, cwd: process.cwd() }))
      .toBe('storage/framework/defaults/app/Models')
  })
})

/**
 * The precedence without a filesystem, so every branch is reachable -
 * including "nothing is installed anywhere", which cannot be produced from
 * inside this repository because the module graph always resolves
 * `@stacksjs/defaults`.
 */
describe('resolveDefaultsRoot', () => {
  const vendored = '/app/storage/framework/defaults'
  const installed = '/app/node_modules/@stacksjs/defaults'

  it('prefers the vendored tree', () => {
    expect(resolveDefaultsRoot(vendored, installed, false, vendored)).toBe(vendored)
  })

  it('prefers the package when the vendored tree is a release behind', () => {
    // `buddy upgrade` is the only thing that writes the vendored tree, so
    // bumping `stacks` and running `bun install` leaves an older copy in
    // front of the version actually declared.
    expect(resolveDefaultsRoot(vendored, installed, true, vendored)).toBe(installed)
  })

  it('keeps a stale vendored tree when nothing is installed to replace it', () => {
    expect(resolveDefaultsRoot(vendored, undefined, true, vendored)).toBe(vendored)
  })

  it('uses the package when nothing is vendored', () => {
    expect(resolveDefaultsRoot(undefined, installed, false, vendored)).toBe(installed)
  })

  it('names the vendored location when neither exists', () => {
    // So a missing-file error points at the path an app is expected to have,
    // not at one inside node_modules.
    expect(resolveDefaultsRoot(undefined, undefined, false, vendored)).toBe(vendored)
  })
})
