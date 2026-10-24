import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyBumps, applyRuntimePins, baseVersion, frameworkPackageUpdateCommand, hasStacksDependency, installedStacksVersion, lockstepPackages, needsFrameworkInstall, publishedRuntimePins, resolvePublishedRuntimePins, standalonePackageUpdateCommand } from '../src/upgrade/packages'

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

  it('reads the requested STX manifest and preserves the paired compiler and component versions', async () => {
    const requested: string[] = []
    const pins = await resolvePublishedRuntimePins({ '@stacksjs/stx': '0.2.682', '@stacksjs/components': '0.2.682', 'bun-plugin-stx': '0.2.682' }, (async (url) => {
      requested.push(String(url))
      return Response.json({ name: '@stacksjs/stx', version: '0.2.682', dependencies: {
        '@stacksjs/desktop': '0.2.682', '@stacksjs/sanitizer': '0.2.682', 'stx-router': '0.2.682', 'bun-plugin-stx': '0.2.682', bunfig: '^0.15.21',
      } })
    }) as typeof fetch)
    expect(requested).toEqual(['https://registry.npmjs.org/@stacksjs%2fstx/0.2.682'])
    expect(pins).toEqual({ '@stacksjs/stx': '0.2.682', '@stacksjs/components': '0.2.682', 'bun-plugin-stx': '0.2.682', '@stacksjs/desktop': '0.2.682', '@stacksjs/sanitizer': '0.2.682', 'stx-router': '0.2.682' })
  })

  it('refuses missing, mismatched or conflicting runtime metadata', async () => {
    const dependencies = { '@stacksjs/stx': '0.2.682', 'bun-plugin-stx': '0.2.682' }
    for (const response of [
      new Response('', { status: 404 }),
      Response.json({ name: '@stacksjs/stx', version: '0.2.683' }),
      Response.json({ name: 'another-package', version: '0.2.682' }),
      Response.json({ name: '@stacksjs/stx', version: '0.2.682', dependencies: { 'bun-plugin-stx': '0.2.683' } }),
    ]) {
      await expect(resolvePublishedRuntimePins(dependencies, (async () => response) as typeof fetch)).rejects.toThrow()
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
