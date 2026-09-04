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
import { meaningfulNpmError, publishables } from './promote-latest'

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

describe('meaningfulNpmError', () => {
  it('skips the log-path footer that used to be reported as the error', () => {
    // The shape npm actually produced when promoting `stacks` failed on
    // v0.74.14. That package is published through OIDC now rather than
    // promoted (6241eb6c52), but the stderr shape is npm's, not that
    // package's, and every promotion can still hit it.
    const stderr = [
      'npm error code E404',
      'npm error 404 Not Found - PUT https://registry.npmjs.org/-/package/stacks/dist-tags/latest',
      'npm error',
      'npm error A complete log of this run can be found in: /home/runner/.npm/_logs/2026-09-03T22_28_52_123Z-debug-0.log',
    ].join('\n')

    expect(meaningfulNpmError(stderr)).toBe('404 Not Found - PUT https://registry.npmjs.org/-/package/stacks/dist-tags/latest')
  })

  it('handles the older npm ERR! prefix', () => {
    expect(meaningfulNpmError('npm ERR! E403 Forbidden\nnpm ERR! A complete log of this run can be found in: /tmp/x.log'))
      .toBe('E403 Forbidden')
  })

  it('says so plainly when npm wrote nothing useful', () => {
    expect(meaningfulNpmError('npm error\nnpm error A complete log of this run can be found in: /tmp/x.log')).toBe('no error output')
    expect(meaningfulNpmError('')).toBe('no error output')
  })
})
