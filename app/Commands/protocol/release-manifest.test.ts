import { describe, expect, it } from 'bun:test'
import type { ReleaseManifest } from './release-manifest'
import { assertReleaseMapping, renderReleaseManifest } from './release-manifest'

describe('release manifest', () => {
  it('requires the framework release version to match the tag', () => {
    expect(() => assertReleaseMapping('v0.70.161', '0.70.161')).not.toThrow()
    expect(() => assertReleaseMapping('v0.70.161', '0.70.160')).toThrow('does not match')
    expect(() => assertReleaseMapping('main')).toThrow('exact semantic version tag')
  })

  it('renders deterministically without wall-clock state', () => {
    const manifest = {
      schemaVersion: '1.0.0',
      repository: 'https://github.com/stacksjs/stacks',
      tag: 'v0.70.161',
      tagType: 'lightweight',
      releaseVersion: '0.70.161',
      releasePackage: 'stacks-framework',
      sourceRevision: 'a9eaab647858ee12d891a74341c99923074a6faf',
      sourceTree: '99ebce98969603c1fa0b0f743efcc04c9de02b98',
      sourceDigest: 'sha256:f20e1dabc57b8b9c0422d6574d756a0fc8ba40b1df2598171e28dcade07e3535',
      generatedAt: 'derived-from-immutable-git-objects',
      rootPackage: { name: 'stacks', version: '0.70.52', private: true },
      prerequisites: { bun: '^1.3.0' },
      packages: [],
      policy: {
        tagMatchesReleasePackageVersion: true,
        rootVersionIsIndependent: true,
        notes: 'test policy',
      },
    } satisfies ReleaseManifest

    expect(manifest.generatedAt).toBe('derived-from-immutable-git-objects')
    expect(renderReleaseManifest(manifest)).toBe(`${JSON.stringify(manifest, null, 2)}\n`)
  })
})
