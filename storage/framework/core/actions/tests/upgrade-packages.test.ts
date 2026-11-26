import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyBumps, applyCraftFloor, applyRuntimePins, craftFloor, declaredCraftPackages, keepsNewerRelease, lockfileOnlyAddCommands, lockfileVersion, resolveCraftPins, baseVersion, frameworkPackageUpdateCommand, hasStacksDependency, installedStacksVersion, lockstepPackages, needsFrameworkInstall, pruneStaleWorkspaceRuntime, publishedRuntimePins, resolvePublishedRuntimePins, splitRuntimeFromLock, standalonePackageUpdateCommand } from '../src/upgrade/packages'

const temporaryProjects: string[] = []

afterEach(() => {
  for (const project of temporaryProjects.splice(0))
    rmSync(project, { recursive: true, force: true })
})

describe('package-only buddy updates', () => {
  it('distinguishes Stacks apps from standalone packages', () => {
    expect(hasStacksDependency({ dependencies: { stacks: '^0.70.160' } })).toBe(true)
    expect(hasStacksDependency({ devDependencies: { stacks: '^0.70.160' } })).toBe(true)
    expect(hasStacksDependency({ devDependencies: { 'better-dx': '^0.2.19' } })).toBe(false)
  })

  it('refreshes only dependencies declared by the standalone package', () => {
    expect(standalonePackageUpdateCommand()).toBe('bun update')
  })

  it('refreshes a Stacks app through the declared meta-package only', () => {
    expect(frameworkPackageUpdateCommand('0.74.66')).toBe('bun update stacks@0.74.66')
    expect(frameworkPackageUpdateCommand('0.74.66', true)).toBe('bun update stacks@0.74.66 --force')
  })

  it('detects an interrupted upgrade whose manifest changed but install did not', () => {
    const project = mkdtempSync(join(tmpdir(), 'stacks-upgrade-'))
    temporaryProjects.push(project)
    mkdirSync(join(project, 'node_modules/stacks'), { recursive: true })
    writeFileSync(join(project, 'node_modules/stacks/package.json'), JSON.stringify({ version: '0.74.9' }))

    expect(installedStacksVersion(project)).toBe('0.74.9')
    expect(needsFrameworkInstall(project, '0.74.11')).toBeTrue()
    expect(needsFrameworkInstall(project, '0.74.9')).toBeFalse()
  })

  it('treats missing or malformed installed metadata as incomplete', () => {
    const project = mkdtempSync(join(tmpdir(), 'stacks-upgrade-'))
    temporaryProjects.push(project)
    expect(installedStacksVersion(project)).toBeNull()
    expect(needsFrameworkInstall(project, '0.74.11')).toBeTrue()

    mkdirSync(join(project, 'node_modules/stacks'), { recursive: true })
    writeFileSync(join(project, 'node_modules/stacks/package.json'), '{')
    expect(installedStacksVersion(project)).toBeNull()
  })

  it('repairs an upgrade that replaced stacks before its lockfile was saved', () => {
    const project = mkdtempSync(join(tmpdir(), 'stacks-upgrade-'))
    temporaryProjects.push(project)
    mkdirSync(join(project, 'node_modules/stacks'), { recursive: true })
    writeFileSync(join(project, 'node_modules/stacks/package.json'), JSON.stringify({ version: '0.74.11' }))
    writeFileSync(join(project, 'bun.lock'), '{"packages":{"stacks":["stacks@0.74.9"],},}')
    expect(needsFrameworkInstall(project, '0.74.11')).toBeTrue()
    writeFileSync(join(project, 'bun.lock'), '{"packages":{"stacks":["stacks@0.74.11"],},}')
    expect(needsFrameworkInstall(project, '0.74.11')).toBeFalse()
    writeFileSync(join(project, 'bun.lock'), '{')
    expect(needsFrameworkInstall(project, '0.74.11')).toBeTrue()
  })

  it('repairs a missing core package after the meta-package moved', () => {
    const project = mkdtempSync(join(tmpdir(), 'stacks-upgrade-'))
    temporaryProjects.push(project)
    mkdirSync(join(project, 'node_modules/stacks'), { recursive: true })
    writeFileSync(join(project, 'node_modules/stacks/package.json'), JSON.stringify({ version: '0.74.11', dependencies: { '@stacksjs/env': '0.74.11' } }))
    expect(needsFrameworkInstall(project, '0.74.11')).toBeTrue()
  })

  it('repairs an older core package after the meta-package moved', () => {
    const project = mkdtempSync(join(tmpdir(), 'stacks-upgrade-'))
    temporaryProjects.push(project)
    mkdirSync(join(project, 'node_modules/stacks'), { recursive: true })
    writeFileSync(join(project, 'node_modules/stacks/package.json'), JSON.stringify({ version: '0.74.11', dependencies: { '@stacksjs/env': '0.74.11' } }))
    mkdirSync(join(project, 'node_modules/@stacksjs/env'), { recursive: true })
    writeFileSync(join(project, 'node_modules/@stacksjs/env/package.json'), JSON.stringify({ version: '0.74.9' }))
    expect(needsFrameworkInstall(project, '0.74.11')).toBeTrue()
    writeFileSync(join(project, 'node_modules/@stacksjs/env/package.json'), JSON.stringify({ version: '0.74.11' }))
    expect(needsFrameworkInstall(project, '0.74.11')).toBeFalse()
  })

  it('checks core resolution from stacks when the installer keeps nested versions', () => {
    const project = mkdtempSync(join(tmpdir(), 'stacks-upgrade-'))
    temporaryProjects.push(project)
    mkdirSync(join(project, 'node_modules/stacks/node_modules/@stacksjs/env'), { recursive: true })
    mkdirSync(join(project, 'node_modules/@stacksjs/env'), { recursive: true })
    writeFileSync(join(project, 'node_modules/stacks/package.json'), JSON.stringify({ version: '0.74.11', dependencies: { '@stacksjs/env': '0.74.11' } }))
    writeFileSync(join(project, 'node_modules/stacks/node_modules/@stacksjs/env/package.json'), JSON.stringify({ version: '0.74.11' }))
    writeFileSync(join(project, 'node_modules/@stacksjs/env/package.json'), JSON.stringify({ version: '0.74.9' }))
    expect(needsFrameworkInstall(project, '0.74.11')).toBeFalse()
  })

  it('repairs an interrupted frontend cohort update even if core did not change', () => {
    const project = mkdtempSync(join(tmpdir(), 'stacks-upgrade-'))
    temporaryProjects.push(project)
    mkdirSync(join(project, 'node_modules/stacks'), { recursive: true })
    mkdirSync(join(project, 'node_modules/@stacksjs/stx'), { recursive: true })
    writeFileSync(join(project, 'package.json'), JSON.stringify({ dependencies: { stacks: '0.74.11', '@stacksjs/stx': '0.2.686' } }))
    writeFileSync(join(project, 'node_modules/stacks/package.json'), JSON.stringify({ version: '0.74.11' }))
    writeFileSync(join(project, 'node_modules/@stacksjs/stx/package.json'), JSON.stringify({ version: '0.2.682' }))
    const pins = { '@stacksjs/stx': '0.2.686', 'stx-router': '0.2.686' }
    expect(needsFrameworkInstall(project, '0.74.11', pins)).toBeTrue()
    writeFileSync(join(project, 'node_modules/@stacksjs/stx/package.json'), JSON.stringify({ version: '0.2.686' }))
    expect(needsFrameworkInstall(project, '0.74.11', pins)).toBeFalse()
  })

  it('accepts the newer patch a declared caret range installed', () => {
    const project = mkdtempSync(join(tmpdir(), 'stacks-upgrade-'))
    temporaryProjects.push(project)
    mkdirSync(join(project, 'node_modules/stacks'), { recursive: true })
    mkdirSync(join(project, 'node_modules/@stacksjs/stx'), { recursive: true })
    writeFileSync(join(project, 'package.json'), JSON.stringify({ dependencies: { stacks: '^0.75.623', '@stacksjs/stx': '^0.2.908' } }))
    writeFileSync(join(project, 'node_modules/stacks/package.json'), JSON.stringify({ version: '0.75.623' }))
    const pins = { '@stacksjs/stx': '0.2.908' }

    // `^0.2.908` installs the newest 0.2.x. Demanding exactly 0.2.908 failed
    // every upgrade of an app whose runtime had published a patch since.
    writeFileSync(join(project, 'node_modules/@stacksjs/stx/package.json'), JSON.stringify({ version: '0.2.910' }))
    expect(needsFrameworkInstall(project, '0.75.623', pins)).toBeFalse()
    // Still behind what the manifest asks for: install again.
    writeFileSync(join(project, 'node_modules/@stacksjs/stx/package.json'), JSON.stringify({ version: '0.2.894' }))
    expect(needsFrameworkInstall(project, '0.75.623', pins)).toBeTrue()
  })

  it('does not repeatedly reinstall intentional source and installer rules', () => {
    const project = mkdtempSync(join(tmpdir(), 'stacks-upgrade-'))
    temporaryProjects.push(project)
    mkdirSync(join(project, 'node_modules/stacks'), { recursive: true })
    writeFileSync(join(project, 'node_modules/stacks/package.json'), JSON.stringify({ version: '0.74.11', dependencies: { '@stacksjs/env': '0.74.11' } }))
    for (const field of ['overrides', 'resolutions']) {
      writeFileSync(join(project, 'package.json'), JSON.stringify({
        dependencies: { stacks: '0.74.11', '@stacksjs/stx': 'file:../stx', 'bun-plugin-stx': '0.2.686' },
        [field]: { '@stacksjs/env': 'file:../env', 'bun-plugin-stx': { '.': 'workspace:*' } },
      }))
      expect(needsFrameworkInstall(project, '0.74.11', { '@stacksjs/stx': '0.2.686', 'bun-plugin-stx': '0.2.686' })).toBeFalse()
    }
  })
})

// stacksjs/stacks#2078: buddy upgrade must not drag independently-versioned
// @stacksjs/* packages (tlsx, ts-cloud) to the framework version — they don't
// publish it, so the resulting package.json fails `bun install`. The `stacks`
// meta declares each dep at the version it actually ships, so only the deps it
// pins AT the framework target are lockstep.
const META_DEPS = {
  '@stacksjs/tlsx': '^0.13.0', // independent line
  '@stacksjs/ts-cloud': '^0.7.49', // independent line
  '@stacksjs/registry': '^0.70.161', // lockstep
  '@stacksjs/server': '^0.70.161', // lockstep
  '@stacksjs/actions': '^0.70.161', // lockstep
  'better-dx': '^0.2.17', // independent, not @stacksjs
}
const TARGET = '0.70.161'

describe('frontend versions paired with a published framework', () => {
  it('aligns direct desktop, sanitizer and router declarations from the published runtime dependencies', () => {
    const pins = publishedRuntimePins({ '@stacksjs/stx': '0.2.682', '@stacksjs/desktop': '0.2.682', '@stacksjs/sanitizer': '0.2.682', 'stx-router': '0.2.682' })
    const pkg = {
      dependencies: { '@stacksjs/desktop': '0.2.679', 'stx-router': '^0.2.679' },
      devDependencies: { '@stacksjs/sanitizer': '~0.2.679' },
    }
    expect(applyRuntimePins(pkg, pins)).toHaveLength(3)
    expect(pkg.dependencies).toEqual({ '@stacksjs/desktop': '0.2.682', 'stx-router': '^0.2.682' })
    expect(pkg.devDependencies).toEqual({ '@stacksjs/sanitizer': '~0.2.682' })
  })

  it('takes the floor of a range as the release the framework was tested against', () => {
    // The framework declares STX as `^0.2.842` so an app on a newer patch
    // installs one copy (stacksjs/stacks#3260). Read as exact versions only,
    // that gave no pins, and an upgrade stopped aligning STX without a word.
    const published = { '@stacksjs/stx': '^0.2.842', '@stacksjs/components': '^0.2.842', 'bun-plugin-stx': '^0.2.842', '@stacksjs/sanitizer': '^0.2.842', 'better-dx': '^0.2.38' }
    expect(publishedRuntimePins(published)).toEqual({ '@stacksjs/stx': '0.2.842', '@stacksjs/components': '0.2.842', 'bun-plugin-stx': '0.2.842', '@stacksjs/sanitizer': '0.2.842' })
    // An app behind the floor is raised to it; one already past it is left alone.
    const behind = { dependencies: { '@stacksjs/stx': '0.2.807', '@stacksjs/components': '0.2.807', 'bun-plugin-stx': '0.2.807' } }
    expect(applyRuntimePins(behind, publishedRuntimePins(published))).toHaveLength(3)
    expect(behind.dependencies).toEqual({ '@stacksjs/stx': '0.2.842', '@stacksjs/components': '0.2.842', 'bun-plugin-stx': '0.2.842' })
    const ahead = { dependencies: { '@stacksjs/stx': '0.2.851', '@stacksjs/components': '0.2.851', 'bun-plugin-stx': '0.2.851' } }
    expect(applyRuntimePins(ahead, publishedRuntimePins(published))).toEqual([])
  })

  it('reads a range as a pin only when the runtime, components and compiler name one release', () => {
    // What older releases published: a floor each, describing no tested release.
    expect(publishedRuntimePins({ '@stacksjs/stx': '^0.2.408', 'bun-plugin-stx': '^0.2.408', '@stacksjs/components': '^0.2.406' })).toEqual({})
    expect(publishedRuntimePins({ '@stacksjs/stx': '^0.2.253', 'bun-plugin-stx': '^0.2.246' })).toEqual({})
    expect(publishedRuntimePins({ '@stacksjs/stx': '^0.2.184' })).toEqual({})
    // A member off the shared floor is left out; the three that agree are the pin.
    expect(publishedRuntimePins({ '@stacksjs/stx': '^0.2.842', '@stacksjs/components': '^0.2.842', 'bun-plugin-stx': '^0.2.842', '@stacksjs/desktop': '^0.2.840' }))
      .toEqual({ '@stacksjs/stx': '0.2.842', '@stacksjs/components': '0.2.842', 'bun-plugin-stx': '0.2.842' })
    // Anything that is not a version, exact or ranged, is still not a pin.
    expect(publishedRuntimePins({ '@stacksjs/stx': 'workspace:*', 'bun-plugin-stx': '>=0.2.842', '@stacksjs/components': 'latest' })).toEqual({})
  })

  it('repairs direct runtime/compiler pins even when stacks already matches the target', () => {
    const pins = publishedRuntimePins({ '@stacksjs/stx': '0.2.679', '@stacksjs/components': '0.2.679', 'bun-plugin-stx': '0.2.679', 'better-dx': '^0.2.38' })
    const pkg = {
      dependencies: { stacks: '0.75.287', '@stacksjs/stx': '0.2.676', '@stacksjs/components': '^0.2.676' },
      devDependencies: { 'bun-plugin-stx': '~0.2.676', 'better-dx': '^0.2.38' },
      overrides: { '@stacksjs/stx': '0.2.676' },
    }
    expect(applyRuntimePins(pkg, pins)).toHaveLength(4)
    expect(pkg.dependencies).toEqual({ stacks: '0.75.287', '@stacksjs/stx': '0.2.679', '@stacksjs/components': '^0.2.679' })
    expect(pkg.devDependencies).toEqual({ 'bun-plugin-stx': '~0.2.679', 'better-dx': '^0.2.38' })
    expect(pkg.overrides['@stacksjs/stx']).toBe('0.2.679')
    expect(applyRuntimePins(pkg, pins)).toEqual([])
  })

  /**
   * A registry with the given releases of each package, `latest` at the newest
   * unless named, and STX manifests whose runtime pins name their own release.
   */
  function registry(releases: Record<string, string[]>, options: { latest?: Record<string, string>, manifest?: (version: string) => unknown } = {}) {
    const requested: string[] = []
    const read = (async (url: string | URL | Request) => {
      const path = decodeURIComponent(String(url).replace('https://registry.npmjs.org/', ''))
      requested.push(path)
      const exact = /^(@stacksjs\/stx)\/(\d.+)$/.exec(path)
      if (exact) {
        return Response.json(options.manifest?.(exact[2]!) ?? { name: '@stacksjs/stx', version: exact[2], dependencies: {
          '@stacksjs/desktop': exact[2], '@stacksjs/sanitizer': exact[2], 'stx-router': exact[2], 'bun-plugin-stx': exact[2], 'bunfig': '^0.15.21',
        } })
      }
      const versions = releases[path]
      if (!versions)
        return new Response('', { status: 404 })
      return Response.json({ 'dist-tags': { latest: options.latest?.[path] ?? versions.at(-1) }, 'versions': Object.fromEntries(versions.map(version => [version, {}])) })
    }) as typeof fetch
    return { read, requested }
  }

  it('reads the requested STX manifest and preserves the paired compiler and component versions', async () => {
    const { read, requested } = registry({ '@stacksjs/stx': ['0.2.682'], '@stacksjs/components': ['0.2.682'], 'bun-plugin-stx': ['0.2.682'] })
    const pins = await resolvePublishedRuntimePins({ '@stacksjs/stx': '0.2.682', '@stacksjs/components': '0.2.682', 'bun-plugin-stx': '0.2.682' }, read)
    expect(requested).toContain('@stacksjs/stx/0.2.682')
    expect(pins).toEqual({ '@stacksjs/stx': '0.2.682', '@stacksjs/components': '0.2.682', 'bun-plugin-stx': '0.2.682', '@stacksjs/desktop': '0.2.682', '@stacksjs/sanitizer': '0.2.682', 'stx-router': '0.2.682' })
  })

  it('pins the newest release the whole runtime cohort published, which is what the framework\'s ranges resolve to', async () => {
    // The framework was tested on 0.2.908 and asks for `^0.2.908`; 0.2.912 is
    // out for all three, 0.2.913 only for the runtime, 0.3.0 is another line.
    const { read } = registry({
      '@stacksjs/stx': ['0.2.908', '0.2.910', '0.2.912', '0.2.913', '0.3.0'],
      '@stacksjs/components': ['0.2.908', '0.2.910', '0.2.912'],
      'bun-plugin-stx': ['0.2.908', '0.2.912'],
    }, { latest: { '@stacksjs/stx': '0.2.913' } })
    const pins = await resolvePublishedRuntimePins({ '@stacksjs/stx': '0.2.908', '@stacksjs/components': '0.2.908', 'bun-plugin-stx': '0.2.908' }, read)

    expect(pins).toMatchObject({ '@stacksjs/stx': '0.2.912', '@stacksjs/components': '0.2.912', 'bun-plugin-stx': '0.2.912', '@stacksjs/desktop': '0.2.912' })
  })

  it('never passes what a package calls its latest release', async () => {
    const { read } = registry({ '@stacksjs/stx': ['0.2.908', '0.2.912'], 'bun-plugin-stx': ['0.2.908', '0.2.912'] }, { latest: { 'bun-plugin-stx': '0.2.908' } })
    expect(await resolvePublishedRuntimePins({ '@stacksjs/stx': '0.2.908', 'bun-plugin-stx': '0.2.908' }, read)).toMatchObject({ '@stacksjs/stx': '0.2.908' })
  })

  it('refuses missing, mismatched or conflicting runtime metadata', async () => {
    const dependencies = { '@stacksjs/stx': '0.2.682', 'bun-plugin-stx': '0.2.682' }
    const releases = { '@stacksjs/stx': ['0.2.682'], 'bun-plugin-stx': ['0.2.682'] }
    for (const { read } of [
      registry({}),
      registry(releases, { manifest: () => ({ name: '@stacksjs/stx', version: '0.2.683' }) }),
      registry(releases, { manifest: () => ({ name: 'another-package', version: '0.2.682' }) }),
      registry(releases, { manifest: () => ({ name: '@stacksjs/stx', version: '0.2.682', dependencies: { 'bun-plugin-stx': '0.2.683' } }) }),
    ]) {
      await expect(resolvePublishedRuntimePins(dependencies, read)).rejects.toThrow()
    }
    expect(dependencies).toEqual({ '@stacksjs/stx': '0.2.682', 'bun-plugin-stx': '0.2.682' })
  })

  it('does not query an invented runtime version for older manifests without exact STX pins', async () => {
    let requests = 0
    expect(await resolvePublishedRuntimePins({ '@stacksjs/stx': '^0.2.100' }, (async () => {
      requests++
      throw new Error('Unexpected request')
    }) as typeof fetch)).toEqual({})
    expect(requests).toBe(0)
  })

  it('does not add absent packages or replace explicit source and scoped installer rules', () => {
    const pkg = { dependencies: { '@stacksjs/stx': 'workspace:*' }, resolutions: { '**/bun-plugin-stx': '0.2.600' } }
    expect(applyRuntimePins(pkg, publishedRuntimePins({ '@stacksjs/stx': '0.2.679', 'bun-plugin-stx': '0.2.679' }))).toEqual([])
    expect(publishedRuntimePins({ '@stacksjs/stx': '^0.2.679', '@stacksjs/components': 'latest' })).toEqual({})
  })
})

describe('framework version bump scoping (stacksjs/stacks#2078)', () => {
  it('strips range operators to a bare version', () => {
    expect(baseVersion('^0.70.161')).toBe('0.70.161')
    expect(baseVersion('~0.13.0')).toBe('0.13.0')
    expect(baseVersion('>=0.7.49')).toBe('0.7.49')
    expect(baseVersion('0.70.161')).toBe('0.70.161')
  })

  it('marks only stacks + @stacksjs deps pinned AT the target as lockstep', () => {
    const lockstep = lockstepPackages(META_DEPS, TARGET)
    expect([...lockstep].sort()).toEqual([
      '@stacksjs/actions',
      '@stacksjs/registry',
      '@stacksjs/server',
      'stacks',
    ])
    // The regression: independently-versioned packages must NOT be lockstep.
    expect(lockstep.has('@stacksjs/tlsx')).toBe(false)
    expect(lockstep.has('@stacksjs/ts-cloud')).toBe(false)
    expect(lockstep.has('better-dx')).toBe(false)
  })

  it('bumps lockstep packages to the target and leaves independent ones untouched', () => {
    const pkg = {
      dependencies: {
        'stacks': '^0.70.93',
        '@stacksjs/server': '^0.70.93',
        '@stacksjs/tlsx': '^0.13.11', // newer than the meta's ^0.13.0 — must not be touched
        '@stacksjs/ts-cloud': '^0.7.28',
        'ofetch': '^1.5.0', // unrelated
      },
    }
    const changes = applyBumps(pkg, TARGET, lockstepPackages(META_DEPS, TARGET))

    // Only the two lockstep packages moved.
    expect(changes.map(c => c.name).sort()).toEqual(['@stacksjs/server', 'stacks'])
    expect(pkg.dependencies.stacks).toBe('^0.70.161')
    expect(pkg.dependencies['@stacksjs/server']).toBe('^0.70.161')
    // The bug: these used to become ^0.70.161 (which does not exist).
    expect(pkg.dependencies['@stacksjs/tlsx']).toBe('^0.13.11')
    expect(pkg.dependencies['@stacksjs/ts-cloud']).toBe('^0.7.28')
    expect(pkg.dependencies.ofetch).toBe('^1.5.0')
  })

  it('preserves the app’s existing range prefix (caret, tilde, exact)', () => {
    const pkg = {
      dependencies: { stacks: '~0.70.93' },
      devDependencies: { '@stacksjs/server': '0.70.93', '@stacksjs/actions': '^0.70.93' },
    }
    applyBumps(pkg, TARGET, lockstepPackages(META_DEPS, TARGET))
    expect(pkg.dependencies.stacks).toBe('~0.70.161')
    expect(pkg.devDependencies['@stacksjs/server']).toBe('0.70.161') // exact pin stays exact
    expect(pkg.devDependencies['@stacksjs/actions']).toBe('^0.70.161')
  })

  it('moves root framework overrides with the declared release instead of retaining an older runtime', () => {
    const pkg = {
      dependencies: { stacks: '^0.70.93', '@stacksjs/server': '0.70.93' },
      overrides: {
        '@stacksjs/server': '0.70.93',
        '@stacksjs/actions': '~0.70.93',
        '@stacksjs/tlsx': '^0.13.11',
        'better-dx': '^0.2.17',
      },
    }

    const changes = applyBumps(pkg, TARGET, lockstepPackages(META_DEPS, TARGET))

    expect(pkg.dependencies['@stacksjs/server']).toBe(TARGET)
    expect(pkg.overrides['@stacksjs/server']).toBe(TARGET)
    expect(pkg.overrides['@stacksjs/actions']).toBe(`~${TARGET}`)
    expect(pkg.overrides['@stacksjs/tlsx']).toBe('^0.13.11')
    expect(pkg.overrides['better-dx']).toBe('^0.2.17')
    expect(changes.filter(change => change.name === '@stacksjs/server')).toHaveLength(2)
    expect(applyBumps(pkg, TARGET, lockstepPackages(META_DEPS, TARGET))).toEqual([])
  })

  it('updates flat Yarn resolutions and preserves explicit aliases, links and dependency references', () => {
    const pkg = {
      dependencies: { stacks: '^0.70.93' },
      resolutions: { '@stacksjs/server': '^0.70.93', '@stacksjs/tlsx': '^0.13.11' },
      overrides: {
        'stacks': '$stacks',
        '@stacksjs/server': 'file:../server',
        '@stacksjs/actions': 'npm:@my-org/actions@1.0.0',
      },
    }

    applyBumps(pkg, TARGET, lockstepPackages(META_DEPS, TARGET))

    expect(pkg.resolutions['@stacksjs/server']).toBe(`^${TARGET}`)
    expect(pkg.resolutions['@stacksjs/tlsx']).toBe('^0.13.11')
    expect(pkg.overrides).toEqual({
      'stacks': '$stacks',
      '@stacksjs/server': 'file:../server',
      '@stacksjs/actions': 'npm:@my-org/actions@1.0.0',
    })
  })

  it('reports an override-only repair so an interrupted upgrade still writes and installs', () => {
    const pkg = {
      dependencies: { stacks: TARGET, '@stacksjs/server': TARGET },
      overrides: { '@stacksjs/server': '0.70.93' },
    }

    expect(applyBumps(pkg, TARGET, lockstepPackages(META_DEPS, TARGET))).toEqual([
      { name: '@stacksjs/server', from: '0.70.93', to: TARGET, field: 'overrides' },
    ])
    expect(pkg.overrides['@stacksjs/server']).toBe(TARGET)
  })

  it('preserves nested and parent- or version-scoped override rules verbatim', () => {
    const overrides = {
      '@stacksjs/server': { '.': '0.70.93', '@stacksjs/actions': '^0.70.93' },
      '@stacksjs/actions@<0.70.100': '0.70.93',
      'stacks>@stacksjs/actions': '0.70.93',
    }
    const resolutions = { 'stacks/@stacksjs/server': '0.70.93', '**/@stacksjs/actions': '0.70.93' }
    const pkg = { dependencies: { stacks: TARGET }, overrides, resolutions }
    const before = JSON.stringify({ overrides, resolutions })

    expect(applyBumps(pkg, TARGET, lockstepPackages(META_DEPS, TARGET))).toEqual([])
    expect(JSON.stringify({ overrides: pkg.overrides, resolutions: pkg.resolutions })).toBe(before)
  })

  it.each(['workspace:*', 'catalog:', 'catalog:framework', 'canary'])('preserves the explicit %s override', (spec) => {
    const pkg = { dependencies: { stacks: TARGET }, overrides: { '@stacksjs/server': spec } }
    expect(applyBumps(pkg, TARGET, lockstepPackages(META_DEPS, TARGET))).toEqual([])
    expect(pkg.overrides['@stacksjs/server']).toBe(spec)
  })
})

describe('newer STX patches the app already runs', () => {
  it('keeps a compatible newer patch and replaces an older or incompatible one', () => {
    expect(keepsNewerRelease('0.2.799', '0.2.798')).toBe(true)
    expect(keepsNewerRelease('^0.2.798', '0.2.798')).toBe(true)
    expect(keepsNewerRelease('0.2.797', '0.2.798')).toBe(false)
    expect(keepsNewerRelease('0.3.0', '0.2.798')).toBe(false)
    expect(keepsNewerRelease('workspace:*', '0.2.798')).toBe(false)
    const pkg = { dependencies: { '@stacksjs/stx': '0.2.799', '@stacksjs/components': '0.2.795' }, overrides: { '@stacksjs/stx': '0.2.799' } }
    const pins = { '@stacksjs/stx': '0.2.798', '@stacksjs/components': '0.2.798' }
    expect(applyRuntimePins(pkg, pins)).toEqual([{ name: '@stacksjs/components', from: '0.2.795', to: '0.2.798' }])
    expect(pkg.dependencies['@stacksjs/stx']).toBe('0.2.799')
    expect(applyRuntimePins(pkg, pins, { exact: true })).toHaveLength(2)
    expect(pkg.overrides['@stacksjs/stx']).toBe('0.2.798')
  })
})

describe('Craft pins follow the framework floor', () => {
  it('reads only a plain >= floor from the published actions manifest', () => {
    expect(craftFloor({ peerDependencies: { 'craft-native': '>=0.0.443' } })).toBe('0.0.443')
    expect(craftFloor({ dependencies: { 'craft-native': '>= 0.0.443' } })).toBe('0.0.443')
    expect(craftFloor({ peerDependencies: { 'craft-native': '^0.0.443' } })).toBeUndefined()
    expect(craftFloor({})).toBeUndefined()
  })

  it('raises old declarations and overrides with their operators, never lowers or adds', () => {
    const pkg = {
      dependencies: { 'craft-native': '0.0.435', '@craft-native/android': '>=0.0.424' },
      devDependencies: { '@craft-native/ios': '~0.0.435' },
      overrides: { 'craft-native': '0.0.435', '@craft-native/ios': '0.0.450' },
      resolutions: { '**/craft-native': '0.0.400' },
    }
    expect(declaredCraftPackages(pkg)).toEqual(['@craft-native/android', '@craft-native/ios', 'craft-native'])
    const pins = { 'craft-native': '0.0.443', '@craft-native/ios': '0.0.443', '@craft-native/android': '0.0.443', '@craft-native/macos': '0.0.443' }
    expect(applyCraftFloor(pkg, pins)).toEqual([
      { name: 'craft-native', from: '0.0.435', to: '0.0.443' },
      { name: '@craft-native/android', from: '>=0.0.424', to: '>=0.0.443' },
      { name: '@craft-native/ios', from: '~0.0.435', to: '~0.0.443' },
      { name: 'craft-native', from: '0.0.435', to: '0.0.443', field: 'overrides' },
    ])
    expect(pkg.overrides['@craft-native/ios']).toBe('0.0.450')
    expect(pkg.resolutions).toEqual({ '**/craft-native': '0.0.400' })
    expect(applyCraftFloor(pkg, pins)).toEqual([])
  })

  it('pins only Craft packages the app declares that publish the floor', async () => {
    const requested: string[] = []
    const pins = await resolveCraftPins({ dependencies: { 'craft-native': '0.0.435', '@craft-native/ios': '0.0.435', '@craft-native/vision': '0.0.1' } }, '0.0.443', (async (url) => {
      requested.push(String(url))
      const [, name] = /registry\.npmjs\.org\/(.+)\/0\.0\.443$/.exec(String(url)) ?? []
      return name === '@craft-native%2fvision' ? new Response('', { status: 404 }) : Response.json({ name: name!.replace('%2f', '/'), version: '0.0.443' })
    }) as typeof fetch)
    expect(pins).toEqual({ '@craft-native/ios': '0.0.443', 'craft-native': '0.0.443' })
    expect(requested).toHaveLength(3)
    expect(await resolveCraftPins({ dependencies: { 'craft-native': '0.0.435' } }, undefined)).toEqual({})
  })
})

describe('raised pins keep the app\'s bun.lock format', () => {
  it('re-resolves exact pins with lockfile-only adds, dev dependencies as dev', () => {
    const pkg = {
      dependencies: { '@stacksjs/stx': '0.2.798', 'craft-native': '0.0.443', 'stacks': '0.75.460' },
      devDependencies: { '@craft-native/ios': '0.0.443', 'bun-plugin-stx': '^0.2.798' },
    }
    expect(lockfileOnlyAddCommands(pkg, ['@stacksjs/stx', 'craft-native', '@craft-native/ios', 'bun-plugin-stx'])).toEqual([
      'bun add --exact --lockfile-only @stacksjs/stx@0.2.798 craft-native@0.0.443',
      'bun add --exact --lockfile-only --dev @craft-native/ios@0.0.443',
    ])
    expect(lockfileOnlyAddCommands(pkg, [])).toEqual([])
  })

  it('reads the lockfile version an install has to preserve', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stacks-upgrade-lockfile-'))
    try {
      expect(lockfileVersion(dir)).toBeNull()
      writeFileSync(join(dir, 'bun.lock'), '{\n  "lockfileVersion": 1,\n  "configVersion": 1,\n}\n')
      expect(lockfileVersion(dir)).toBe(1)
    }
    finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('one STX runtime after an upgrade', () => {
  const entry = (name: string, version: string): unknown[] => [`${name}@${version}`, '', {}, 'sha512-x']

  it('drops every entry of a runtime package the lock resolves twice, and nothing else', () => {
    // The shape uplink was left in: a top-level copy another dependent's
    // range still allowed, and the framework's newer one nested beneath it.
    const lock = { packages: {
      '@stacksjs/stx': entry('@stacksjs/stx', '0.2.798'),
      '@stacksjs/actions/@stacksjs/stx': entry('@stacksjs/stx', '0.2.913'),
      '@stacksjs/buddy/@stacksjs/stx': entry('@stacksjs/stx', '0.2.913'),
      'bun-plugin-stx': entry('bun-plugin-stx', '0.2.913'),
      '@stacksjs/actions': entry('@stacksjs/actions', '0.75.628'),
    } }
    expect(splitRuntimeFromLock(lock)).toEqual(['@stacksjs/stx'])
    expect(Object.keys(lock.packages)).toEqual(['bun-plugin-stx', '@stacksjs/actions'])
  })

  it('leaves a lock with one version of each alone', () => {
    const lock = { packages: {
      '@stacksjs/stx': entry('@stacksjs/stx', '0.2.913'),
      '@stacksjs/actions/@stacksjs/stx': entry('@stacksjs/stx', '0.2.913'),
    } }
    expect(splitRuntimeFromLock(lock)).toEqual([])
    expect(Object.keys(lock.packages)).toHaveLength(2)
  })

  it('removes only older physical workspace copies with no nested lock entry', () => {
    const project = mkdtempSync(join(tmpdir(), 'stacks-upgrade-stale-runtime-'))
    temporaryProjects.push(project)
    const stx = '@stacksjs/stx'
    const install = (workspace: string, name: string, version: string): string => {
      const path = join(project, workspace, 'node_modules', name)
      mkdirSync(path, { recursive: true })
      writeFileSync(join(path, 'package.json'), JSON.stringify({ name, version }))
      return path
    }
    const hoisted = install('', stx, '0.2.946')
    const stale = install('packages/server', stx, '0.2.944')
    const newer = install('packages/web', stx, '0.2.947')
    const nonWorkspace = install('example', stx, '0.2.944')
    const pinned = install('packages/server', 'bun-plugin-stx', '0.2.944')
    const linkedSource = install('fixture', stx, '0.2.944')
    const linkParent = join(project, 'packages/linked/node_modules/@stacksjs')
    mkdirSync(linkParent, { recursive: true })
    const link = join(linkParent, 'stx')
    symlinkSync(linkedSource, link, 'junction')

    const lock = { packages: {
      [stx]: entry(stx, '0.2.946'),
      'bun-plugin-stx': entry('bun-plugin-stx', '0.2.946'),
      '@project/server/bun-plugin-stx': entry('bun-plugin-stx', '0.2.944'),
    }, workspaces: { '': {}, 'packages/server': {}, 'packages/web': {}, 'packages/linked': {} } }

    install('', 'bun-plugin-stx', '0.2.946')
    expect(pruneStaleWorkspaceRuntime(project, lock)).toEqual([join('packages/server', 'node_modules', stx)])
    expect(existsSync(stale)).toBe(false)
    for (const path of [hoisted, newer, nonWorkspace, pinned, linkedSource, link])
      expect(existsSync(path)).toBe(true)
    expect(pruneStaleWorkspaceRuntime(project, lock)).toEqual([])
  })
})
