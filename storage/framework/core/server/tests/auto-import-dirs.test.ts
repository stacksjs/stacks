/**
 * Where the framework-default scan directories resolve from.
 *
 * The bug these pin: every one of these was `path.storagePath(
 * 'framework/defaults/<sub>')` and nothing else. That is right for a vendored
 * app and fatal for one consuming the framework as packages — the scan was
 * handed a path that does not exist, and `scanDirExportsDetailed` in
 * bun-plugin-auto-imports throws on a missing directory instead of returning
 * nothing, so the API died at boot with
 *
 *   Failed to scan directory .../storage/framework/defaults/functions
 *
 * The throw is inside the plugin, so the try/catch tolerance already wrapped
 * around these scans never saw it.
 */
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'bun:test'
import { path } from '@stacksjs/path'
import { autoImportSourceDirs, frameworkDefaultsDir } from '../src/imports'

describe('framework-default scan directories', () => {
  it('never reports a directory that does not exist', () => {
    // The invariant that keeps boot alive. Anything this returns is handed to a
    // scanner that throws on a missing path, so a non-existent entry here is
    // the crash, not a warning.
    const missing = autoImportSourceDirs().filter(dir => !existsSync(dir))
    expect(missing).toEqual([])
  })

  it('prefers the vendored copy, so a vendored app resolves exactly as before', () => {
    // This repo IS the vendored tree, so every lookup must land inside it and
    // never in node_modules. That is what makes the change a no-op for every
    // existing project.
    for (const sub of ['functions', 'app/Models', 'app/Controllers']) {
      const resolved = frameworkDefaultsDir(sub)
      const vendored = path.storagePath(`framework/defaults/${sub}`)

      if (!existsSync(vendored))
        continue

      expect(resolved).toBe(vendored)
    }
  })

  it('resolves each directory it returns, or returns undefined — never a guess', () => {
    for (const sub of ['functions', 'app/Models', 'app/Controllers']) {
      const resolved = frameworkDefaultsDir(sub)
      if (resolved !== undefined)
        expect(existsSync(resolved)).toBe(true)
    }
  })

  it('returns undefined for a subdirectory that exists in neither place', () => {
    expect(frameworkDefaultsDir('definitely-not-a-real-defaults-subdir')).toBeUndefined()
  })

  it('still reports the user-space directories', () => {
    // The fallback must not have narrowed the scan to framework defaults only.
    // Whichever of these exist in this repo must still be listed.
    const dirs = autoImportSourceDirs()
    const userDirs = [path.resourcesPath('functions'), path.userModelsPath(), path.userControllersPath()]

    for (const dir of userDirs) {
      if (existsSync(dir))
        expect(dirs).toContain(dir)
    }
  })
})
