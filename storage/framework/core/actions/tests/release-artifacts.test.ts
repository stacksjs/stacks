import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * `bump.ts` runs its release on import, so these read it as source rather than
 * calling into it.
 */
describe('framework release artifact staging', () => {
  const source = (): string => readFileSync(resolve(__dirname, '../src/bump.ts'), 'utf8')

  test('never stages dependency or scratch manifests outside storage/framework', () => {
    expect(source()).toContain("':(glob)storage/framework/**/package.json'")
    expect(source()).not.toContain("':(glob)**/package.json'")
  })

  /**
   * A pathspec that matches nothing is fatal to `git add` (exit 128), and a
   * consumer app has no manifests under `storage/framework` — so staging that
   * glob unconditionally aborted every consumer release *after* the bump had
   * already rewritten package.json, CHANGELOG.md and bun.lock, leaving the
   * release half-applied and untagged.
   */
  test('stages the vendored core manifests only for a framework release', () => {
    const staging = source().slice(source().indexOf('async function stageReleaseArtifacts'))

    expect(staging).toMatch(
      /const pathspecs = isFrameworkRelease\s*\?\s*\[':\(glob\)storage\/framework\/\*\*\/package\.json', 'package\.json'\]\s*:\s*\['package\.json'\]/,
    )
  })
})
