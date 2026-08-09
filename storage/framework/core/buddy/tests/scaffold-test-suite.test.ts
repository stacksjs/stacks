// What a generated app inherits as its `tests/`.
//
// Same root as scaffold-vcs-template: `buddy new` scaffolds by downloading
// this repository, so without an explicit step the app inherits the
// FRAMEWORK's test suite — files asserting on `storage/framework/defaults/...`
// and on the layout of `core/`. The default unvendor deletes both a few steps
// later, so every one of them fails on ENOENT in an app that never asked for
// them and cannot fix them.
//
// erbamarkets shipped that way: 41 files, byte-identical to this repo's own,
// 117 red from its first commit. The failures are not the real cost. A suite
// that is always red is read exactly as often as no suite, so the app's first
// genuine test lands in a list nobody looks at.
//
// `tests/setup.ts` is the exception, and the reason this is a filtered removal
// rather than an `rm -rf tests`: it is harness, not assertion — it seeds the
// env vars config reads at module scope, shims `requestAnimationFrame` for a
// runtime that has none, and `bunfig.toml` preloads it by name.

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CREATE_COMMAND = join(import.meta.dir, '../src/commands/create.ts')
const source = readFileSync(CREATE_COMMAND, 'utf8')

describe('scaffolding does not hand the app the framework tests', () => {
  test('the removal runs', () => {
    expect(source).toContain('removeFrameworkTests(path)')
  })

  test('it runs before the framework is unvendored', () => {
    // Ordering is not cosmetic: `unvendorCore` deletes `storage/framework`,
    // and after that point the app is left holding tests whose subject is
    // gone. Removing first means the app never sees them at all.
    expect(source.indexOf('removeFrameworkTests(path)'))
      .toBeLessThan(source.indexOf('await unvendorCore(path, options)'))
  })

  test('it keeps the harness', () => {
    const body = source.slice(
      source.indexOf('function removeFrameworkTests'),
      source.indexOf('function ensureExecutableScripts'),
    )

    expect(body).toContain('setup.ts')
    expect(body).toContain('continue')
  })

  test('it tolerates a template with no tests directory', () => {
    const body = source.slice(
      source.indexOf('function removeFrameworkTests'),
      source.indexOf('function ensureExecutableScripts'),
    )

    expect(body).toContain('existsSync')
  })
})
