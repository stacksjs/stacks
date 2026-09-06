/**
 * A `files` entry names something that is actually there.
 *
 * `@stacksjs/shell` listed `buddy.plugin.zsh` at the package root, and the file
 * lives at `src/buddy.plugin.zsh`. npm does not warn about a `files` entry that
 * matches nothing, so the published tarball held 7 files and not the plugin -
 * while `upgrade:shell` reads exactly that path to install the Oh My Zsh
 * plugin. The manifest said it shipped; it did not.
 *
 * Only plain paths are checked. A glob that currently matches nothing is not
 * necessarily wrong, and `README.md` / `LICENSE.md` are included by npm
 * whether or not they are listed, so a stale entry for those ships nothing
 * incorrect.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../../../../', import.meta.url).pathname
const coreDir = join(root, 'storage/framework/core')

/** npm ships these regardless of `files`, so a stale entry is harmless. */
const alwaysIncluded = new Set(['README.md', 'LICENSE.md', 'LICENSE', 'package.json'])

describe('package manifests', () => {
  it('list no `files` entry that does not exist', () => {
    const missing: string[] = []

    for (const entry of readdirSync(coreDir)) {
      const pkgDir = join(coreDir, entry)
      if (!statSync(pkgDir).isDirectory())
        continue

      const manifestPath = join(pkgDir, 'package.json')
      if (!existsSync(manifestPath))
        continue

      let manifest: { name?: string, private?: boolean, files?: string[] }
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      }
      catch {
        continue
      }

      if (!manifest.name || manifest.private)
        continue

      for (const file of manifest.files ?? []) {
        // A glob is allowed to match nothing today.
        if (/[*?[\]!]/.test(file) || alwaysIncluded.has(file))
          continue

        // `dist` is gitignored, so a fresh checkout has none until a build.
        if (file === 'dist' && !existsSync(join(pkgDir, 'dist')))
          continue

        /*
         * `core/defaults` is generated: `core/defaults/build.ts` copies
         * `storage/framework/defaults/*` into it, and everything but the
         * manifest and that script is gitignored. Check the source it is
         * copied from, or this reports `routes` missing on any checkout that
         * has not built - the published tarball carries all 9 route files.
         */
        /*
         * `core/defaults` ships nothing that exists before a build:
         * `core/defaults/build.ts` copies `storage/framework/defaults/*` into
         * it, and assembles `project/` from repo-root files that live under no
         * single directory. So `routes` is checkable against the source tree,
         * `project` is checkable against nothing at all, and on a fresh
         * checkout neither is present.
         *
         * Checked where it can be, skipped where it cannot. The published
         * tarball carries all of it - 2235 files including the 9 routes.
         */
        const assembledAtBuild = entry === 'defaults' && file === 'project'
        if (assembledAtBuild)
          continue

        const candidates = entry === 'defaults'
          ? [join(pkgDir, file), join(root, 'storage/framework/defaults', file)]
          : [join(pkgDir, file)]

        if (!candidates.some(candidate => existsSync(candidate)))
          missing.push(`${manifest.name}: ${file}`)
      }
    }

    expect(missing.sort()).toEqual([])
  })
})
