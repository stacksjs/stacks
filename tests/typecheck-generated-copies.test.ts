/**
 * The framework typecheck never reads the `@stacksjs/defaults` build copy.
 *
 * `storage/framework/core/defaults/build.ts` copies the whole of
 * `storage/framework/defaults/` beside itself, plus a `project/` tree of root
 * support files, so the package can ship the scaffold to npm. The copies are
 * gitignored and resolve their imports from the wrong directory. The exclude
 * list named two of the copied directories, written when those were all the
 * build copied; it has since copied everything.
 *
 * One stray file was enough to break the whole check: the copied
 * `project/storage/framework/types/model-events.d.ts` augments the real
 * `@stacksjs/events` module from a directory where its models barrel does not
 * exist. The event map's keys widened to `string`, the map became an index
 * signature, and every model event failed TS2411 - 816 errors on `bun run
 * typecheck` after any local package build. CI never builds the package first,
 * so it stayed green.
 *
 * Asked of the compiler, not of the config text: `tsc --showConfig` lists the
 * files it would check. A probe is written into each copied location first,
 * since on a clean checkout there is nothing there to find.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dir, '..')
const framework = join(root, 'storage/framework')
const copyRoot = join(framework, 'core/defaults')
const probeName = '__typecheck_probe__'

/** Every place the build writes, one probe file in each. */
const probes = [
  ...readdirSync(join(framework, 'defaults'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(copyRoot, entry.name, probeName, 'probe.ts')),
  join(copyRoot, 'project/storage/framework/types', probeName, 'probe.d.ts'),
]

beforeAll(() => {
  for (const probe of probes) {
    mkdirSync(join(probe, '..'), { recursive: true })
    writeFileSync(probe, 'export {}\n')
  }
})

afterAll(() => {
  for (const probe of probes)
    rmSync(join(probe, '..'), { recursive: true, force: true })
})

describe('tsconfig.framework.json', () => {
  it('checks none of the files the defaults build copies', () => {
    const result = Bun.spawnSync([process.execPath, 'x', '--bun', 'tsc', '--showConfig', '-p', join(framework, 'tsconfig.framework.json')], {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const output = result.stdout.toString()
    const config = JSON.parse(output.slice(output.indexOf('{')))
    const files: string[] = config.files ?? []

    // The listing itself worked, so an empty result below means something.
    expect(files.length).toBeGreaterThan(100)

    const copied = files.filter(file => file.includes('core/defaults/'))
    expect(copied).toEqual([])

    // And the probes really were in places the include glob would reach.
    expect(probes.map(probe => relative(framework, probe)).every(path => path.startsWith('core/defaults/'))).toBe(true)
  }, 60_000)
})
