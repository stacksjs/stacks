/**
 * The promoted set must be exactly the published set.
 *
 * A package pantry publishes but this does not promote is stranded on the
 * holding tag; one promoted but not published names a version that is not
 * there. Both are the torn release the staged publish exists to prevent, so
 * the enumeration is pinned to the same globs the workflow passes.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { publishables } from './promote-latest'

const root = new URL('../../', import.meta.url).pathname

describe('publishables', () => {
  it('finds the scoped framework packages but not the separately published meta-package', async () => {
    const found = await publishables(root)
    const names = found.map(pkg => pkg.name)

    expect(names).not.toContain('stacks')
    expect(names).toContain('@stacksjs/actions')
    expect(names.length).toBeGreaterThan(50)
  })

  it('gives every package a concrete version to point latest at', async () => {
    const found = await publishables(root)

    // `workspace:*` or a missing version cannot address a registry entry.
    for (const pkg of found)
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('skips private packages, which never reach the registry', async () => {
    const found = await publishables(root)

    for (const pkg of found) {
      const manifest = JSON.parse(readFileSync(`${root}${pkg.dir}/package.json`, 'utf-8'))
      expect(manifest.private).toBeFalsy()
    }
  })

  it('covers the same globs the release workflow publishes', async () => {
    const workflow = readFileSync(`${root}.github/workflows/release.yml`, 'utf-8')

    // If the publish step's globs change, this enumeration has to change with
    // them - so fail here rather than stranding whatever the new glob adds.
    expect(workflow).toContain("--tag staging 'storage/framework/core/*'")
    expect(workflow).toContain("--ignore-scripts 'storage/framework/core'")
  })
})
