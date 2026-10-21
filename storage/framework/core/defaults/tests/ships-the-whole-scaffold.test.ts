import { describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { syncPackageProjectFiles } from '../../actions/src/upgrade/package-project'

/**
 * `@stacksjs/defaults` must ship everything the scaffold needs.
 *
 * The package is a publish wrapper: `build.ts` copies every entry of
 * `storage/framework/defaults` into this directory, and `files` in
 * `package.json` decides what npm then publishes. Those two lists are
 * maintained by hand and independently, so a new top-level directory in the
 * source tree gets copied by the build and silently dropped by the publish.
 *
 * That is not a cosmetic gap. `buddy upgrade` syncs an app's vendored defaults
 * from the installed package and MIRRORS it - `syncDirectory` removes any
 * target entry the source does not have - so a directory missing from `files`
 * is deleted out of every app that upgrades. The sibling test below proves
 * that with the real sync rather than by reading it.
 *
 * It matters more as #2941 proceeds. While the vendored copy is what executes,
 * a dropped file is only missing from `node_modules`; once the package becomes
 * the copy that executes, it is a 500.
 *
 * See stacksjs/stacks#2941.
 */

const sourceTree = resolve(import.meta.dir, '../../../defaults')
const manifest = JSON.parse(readFileSync(resolve(import.meta.dir, '../package.json'), 'utf8')) as {
  files: string[]
}

/**
 * Source-tree entries that deliberately do not ship, and why.
 *
 * Kept as an explicit list so that adding a top-level directory to the
 * defaults tree forces a decision about publishing it, rather than inheriting
 * whichever answer `files` happens to already give.
 */
const DOES_NOT_SHIP = new Map<string, string>([
  // A placeholder that exists only to keep the directory in git.
  ['.gitkeep', 'git placeholder, meaningless in a package'],
])

describe('@stacksjs/defaults ships the whole scaffold', () => {
  it('publishes every top-level entry the build copies', () => {
    const shipped = new Set(manifest.files)
    const copied = readdirSync(sourceTree)

    const dropped = copied.filter(entry => !shipped.has(entry) && !DOES_NOT_SHIP.has(entry))

    // Named in the failure rather than just counted: the whole value of this
    // test is telling you WHICH directory stopped shipping.
    expect(dropped).toEqual([])
  })

  /**
   * Entries `files` publishes that the source tree does not supply, because
   * the package owns them itself rather than copying them.
   */
  const PACKAGE_OWNED = new Set([
    // Written by `build.ts` from the repository root, not from the tree.
    'project',
    // This package's own README, tracked here and un-ignored in .gitignore.
    'README.md',
  ])

  it('does not list entries the source tree no longer has', () => {
    // The other direction. `files` naming a directory that was renamed or
    // removed publishes nothing while reading as though it does, and the sync
    // would then stop treating the app's copy as managed.
    const present = new Set(readdirSync(sourceTree))
    const stale = manifest.files.filter(entry => !present.has(entry) && !PACKAGE_OWNED.has(entry))

    expect(stale).toEqual([])
  })
})

/**
 * The consequence, with the real sync rather than an argument about it.
 *
 * Builds an app whose vendored defaults carry a directory, and an installed
 * package that does not, then runs the upgrade sync and checks what is left.
 */
describe('buddy upgrade mirrors the package into an app', () => {
  function fixture(packageHasIt: boolean): { root: string, file: string } {
    const root = mkdtempSync(join(tmpdir(), 'defaults-sync-'))

    const vendored = join(root, 'storage/framework/defaults')
    mkdirSync(join(vendored, 'scaffold/config'), { recursive: true })
    writeFileSync(join(vendored, 'scaffold/config/app.ts'), 'export default {}\n')
    mkdirSync(join(vendored, 'app'), { recursive: true })
    writeFileSync(join(vendored, 'app/keep.ts'), 'export default 1\n')

    const pkg = join(root, 'node_modules/@stacksjs/defaults')
    mkdirSync(join(pkg, 'app'), { recursive: true })
    writeFileSync(join(pkg, 'app/keep.ts'), 'export default 1\n')
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: '@stacksjs/defaults', version: '0.0.0' }))
    if (packageHasIt) {
      mkdirSync(join(pkg, 'scaffold/config'), { recursive: true })
      writeFileSync(join(pkg, 'scaffold/config/app.ts'), 'export default {}\n')
    }

    return { root, file: join(vendored, 'scaffold/config/app.ts') }
  }

  it('deletes a directory the package does not carry', () => {
    const { root, file } = fixture(false)
    try {
      expect(existsSync(file)).toBe(true)
      const changes = syncPackageProjectFiles(root, join(root, 'node_modules/@stacksjs/defaults'))

      expect(existsSync(file)).toBe(false)
      expect(changes).toContainEqual({ path: 'storage/framework/defaults/scaffold', action: 'remove' })
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // The control. Without it the assertion above is satisfied by a sync that
  // deletes indiscriminately, which would be a different bug with the same
  // symptom.
  it('keeps it when the package does carry it', () => {
    const { root, file } = fixture(true)
    try {
      syncPackageProjectFiles(root, join(root, 'node_modules/@stacksjs/defaults'))
      expect(existsSync(file)).toBe(true)
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
