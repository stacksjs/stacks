/**
 * Discovery and the auto-import staleness check must name the same manifest.
 *
 * `discoverPackages()` writes `storage/framework/discovered-packages.json`, and
 * `autoImportsAreStale()` reads that file's mtime to decide whether the set of
 * installed packages has moved since the auto-import barrel was built. That is
 * the only signal it has: a package's own model files carry the mtimes from its
 * tarball, so a freshly installed package's models are routinely OLDER than the
 * barrel and never trip an mtime comparison.
 *
 * The two live in different packages and each names the path itself. If either
 * moves, nothing throws - `existsSync` on the old path simply returns false, the
 * staleness check stops firing, and `bun add loghq` goes back to needing two
 * boots before its models resolve. Silent, and indistinguishable from a cache
 * that happened to be warm.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const coreRoot = resolve(import.meta.dir, '../..')

/** Every `storagePath('framework/…json')` literal a source file names. */
function manifestPathsIn(relative: string): string[] {
  const source = readFileSync(resolve(coreRoot, relative), 'utf8')
  return [...source.matchAll(/storagePath\(\s*'(framework\/[^']*\.json)'\s*\)/g)].map(m => m[1])
}

describe('the discovery manifest path', () => {
  test('is a single literal in the writer, which is what the reader must match', () => {
    // Guards the regex: if the call shape changes so this matches nothing, the
    // agreement test below would pass vacuously against an empty needle.
    expect(manifestPathsIn('actions/src/discover-packages.ts'))
      .toEqual(['framework/discovered-packages.json'])
  })

  test('is named by the staleness check too', () => {
    const [written] = manifestPathsIn('actions/src/discover-packages.ts')

    // `imports.ts` legitimately names several manifests - the server and
    // browser auto-import ones - so this asks that the discovery manifest is
    // among them, not that it is the only one.
    expect(manifestPathsIn('server/src/imports.ts')).toContain(written)
  })

  test('is read by the staleness check itself, not merely mentioned in the file', () => {
    const source = readFileSync(resolve(coreRoot, 'server/src/imports.ts'), 'utf8')
    const start = source.indexOf('export function autoImportsAreStale')
    expect(start).toBeGreaterThan(-1)

    // Scoped to that function's body. The path appearing elsewhere in the file
    // would satisfy the test above while the staleness check ignored it.
    const body = source.slice(start, source.indexOf('\nexport ', start + 1))
    expect(body).toContain('framework/discovered-packages.json')
  })
})
