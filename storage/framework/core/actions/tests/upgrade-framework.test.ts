import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const {
  resolveUpgradeContext,
  buildTemplateString,
  readVersion,
  readChannel,
  writeChannel,
  resolveUpgradeMessage,
  resolveSuccessMessage,
} = await import('../src/upgrade/framework-utils')

// Temp directory for isolated file operations
let testDir: string

beforeEach(() => {
  testDir = join(tmpdir(), `stacks-upgrade-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(testDir, { recursive: true })
})

afterEach(() => {
  try {
    if (existsSync(testDir))
      rmSync(testDir, { recursive: true, force: true })
  }
  catch {}
})

// ─── resolveUpgradeContext ───────────────────────────────────────────────────

describe('resolveUpgradeContext', () => {
  describe('default behavior', () => {
    it('should default to stable/main when no options and channel is stable', () => {
      const ctx = resolveUpgradeContext({}, 'stable')
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe('main')
      expect(ctx.targetVersion).toBeUndefined()
    })

    it('should stay on canary if current channel is canary and no flags', () => {
      const ctx = resolveUpgradeContext({}, 'canary')
      expect(ctx.channel).toBe('canary')
      expect(ctx.ref).toBe('canary')
      expect(ctx.targetVersion).toBeUndefined()
    })
  })

  describe('--canary flag', () => {
    it('should switch to canary when --canary is set', () => {
      const ctx = resolveUpgradeContext({ canary: true }, 'stable')
      expect(ctx.channel).toBe('canary')
      expect(ctx.ref).toBe('canary')
    })

    it('should stay on canary when already on canary and --canary is set', () => {
      const ctx = resolveUpgradeContext({ canary: true }, 'canary')
      expect(ctx.channel).toBe('canary')
      expect(ctx.ref).toBe('canary')
    })
  })

  describe('--stable flag', () => {
    it('should switch to stable when --stable is set from canary', () => {
      const ctx = resolveUpgradeContext({ stable: true }, 'canary')
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe('main')
    })

    it('should stay on stable when already stable and --stable is set', () => {
      const ctx = resolveUpgradeContext({ stable: true }, 'stable')
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe('main')
    })
  })

  describe('--version flag', () => {
    it('should use version tag without v prefix', () => {
      const ctx = resolveUpgradeContext({ version: '0.70.23' }, 'stable')
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe('v0.70.23')
      expect(ctx.targetVersion).toBe('0.70.23')
    })

    it('should use version tag with v prefix as-is', () => {
      const ctx = resolveUpgradeContext({ version: 'v0.70.23' }, 'stable')
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe('v0.70.23')
      expect(ctx.targetVersion).toBe('v0.70.23')
    })

    it('should take priority over --canary', () => {
      const ctx = resolveUpgradeContext({ version: '0.70.23', canary: true }, 'stable')
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe('v0.70.23')
      expect(ctx.targetVersion).toBe('0.70.23')
    })

    it('should take priority over --stable', () => {
      const ctx = resolveUpgradeContext({ version: '0.70.23', stable: true }, 'canary')
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe('v0.70.23')
    })

    it('should take priority over persisted canary channel', () => {
      const ctx = resolveUpgradeContext({ version: '0.70.23' }, 'canary')
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe('v0.70.23')
    })

    it('should handle semver-only strings', () => {
      const ctx = resolveUpgradeContext({ version: '1.0.0' }, 'stable')
      expect(ctx.ref).toBe('v1.0.0')
    })

    it('should handle pre-release version strings', () => {
      const ctx = resolveUpgradeContext({ version: '1.0.0-beta.1' }, 'stable')
      expect(ctx.ref).toBe('v1.0.0-beta.1')
    })
  })

  describe('flag priority', () => {
    it('--version beats --canary beats --stable beats persisted channel', () => {
      // version > canary
      const v = resolveUpgradeContext({ version: '1.0.0', canary: true, stable: true }, 'canary')
      expect(v.ref).toBe('v1.0.0')

      // canary > stable (when no version)
      const c = resolveUpgradeContext({ canary: true, stable: true }, 'stable')
      expect(c.channel).toBe('canary')

      // stable > persisted canary (when no version/canary)
      const s = resolveUpgradeContext({ stable: true }, 'canary')
      expect(s.channel).toBe('stable')
    })
  })
})

// ─── buildTemplateString ─────────────────────────────────────────────────────

describe('buildTemplateString', () => {
  it('should build template for main branch', () => {
    expect(buildTemplateString('main'))
      .toBe('github:stacksjs/stacks#main/storage/framework/core')
  })

  it('should build template for canary branch', () => {
    expect(buildTemplateString('canary'))
      .toBe('github:stacksjs/stacks#canary/storage/framework/core')
  })

  it('should build template for a version tag', () => {
    expect(buildTemplateString('v0.70.23'))
      .toBe('github:stacksjs/stacks#v0.70.23/storage/framework/core')
  })

  it('should build template for a pre-release tag', () => {
    expect(buildTemplateString('v1.0.0-beta.1'))
      .toBe('github:stacksjs/stacks#v1.0.0-beta.1/storage/framework/core')
  })
})

// ─── readVersion ─────────────────────────────────────────────────────────────

describe('readVersion', () => {
  it('should read version from a valid package.json', () => {
    const pkgPath = join(testDir, 'package.json')
    writeFileSync(pkgPath, JSON.stringify({ name: 'test', version: '0.70.23' }))
    expect(readVersion(pkgPath)).toBe('0.70.23')
  })

  it('should return null when file does not exist', () => {
    expect(readVersion(join(testDir, 'nonexistent.json'))).toBeNull()
  })

  it('should return null when version field is missing', () => {
    const pkgPath = join(testDir, 'package.json')
    writeFileSync(pkgPath, JSON.stringify({ name: 'test' }))
    expect(readVersion(pkgPath)).toBeNull()
  })

  it('should return null when version is empty string', () => {
    const pkgPath = join(testDir, 'package.json')
    writeFileSync(pkgPath, JSON.stringify({ name: 'test', version: '' }))
    expect(readVersion(pkgPath)).toBeNull()
  })

  it('should return null for invalid JSON', () => {
    const pkgPath = join(testDir, 'package.json')
    writeFileSync(pkgPath, 'not valid json{{{')
    expect(readVersion(pkgPath)).toBeNull()
  })

  it('should return null for an empty file', () => {
    const pkgPath = join(testDir, 'package.json')
    writeFileSync(pkgPath, '')
    expect(readVersion(pkgPath)).toBeNull()
  })

  it('should handle pre-release versions', () => {
    const pkgPath = join(testDir, 'package.json')
    writeFileSync(pkgPath, JSON.stringify({ version: '1.0.0-beta.1' }))
    expect(readVersion(pkgPath)).toBe('1.0.0-beta.1')
  })
})

// ─── readChannel / writeChannel ──────────────────────────────────────────────

describe('readChannel', () => {
  it('should return stable when channel file does not exist', () => {
    expect(readChannel(join(testDir, 'nonexistent'))).toBe('stable')
  })

  it('should return stable when channel file contains "stable"', () => {
    const file = join(testDir, '.stacks-channel')
    writeFileSync(file, 'stable')
    expect(readChannel(file)).toBe('stable')
  })

  it('should return canary when channel file contains "canary"', () => {
    const file = join(testDir, '.stacks-channel')
    writeFileSync(file, 'canary')
    expect(readChannel(file)).toBe('canary')
  })

  it('should return stable for unrecognized channel values', () => {
    const file = join(testDir, '.stacks-channel')
    writeFileSync(file, 'beta')
    expect(readChannel(file)).toBe('stable')
  })

  it('should trim whitespace from channel file', () => {
    const file = join(testDir, '.stacks-channel')
    writeFileSync(file, '  canary  \n')
    expect(readChannel(file)).toBe('canary')
  })

  it('should return stable for empty channel file', () => {
    const file = join(testDir, '.stacks-channel')
    writeFileSync(file, '')
    expect(readChannel(file)).toBe('stable')
  })
})

describe('writeChannel', () => {
  it('should write stable to channel file', () => {
    const file = join(testDir, '.stacks-channel')
    writeChannel(file, 'stable')
    expect(readFileSync(file, 'utf-8')).toBe('stable')
  })

  it('should write canary to channel file', () => {
    const file = join(testDir, '.stacks-channel')
    writeChannel(file, 'canary')
    expect(readFileSync(file, 'utf-8')).toBe('canary')
  })

  it('should overwrite existing channel', () => {
    const file = join(testDir, '.stacks-channel')
    writeChannel(file, 'canary')
    writeChannel(file, 'stable')
    expect(readFileSync(file, 'utf-8')).toBe('stable')
  })

  it('should not throw when directory does not exist', () => {
    const file = join(testDir, 'nonexistent-dir', '.stacks-channel')
    expect(() => writeChannel(file, 'stable')).not.toThrow()
  })
})

describe('readChannel and writeChannel round-trip', () => {
  it('should round-trip stable', () => {
    const file = join(testDir, '.stacks-channel')
    writeChannel(file, 'stable')
    expect(readChannel(file)).toBe('stable')
  })

  it('should round-trip canary', () => {
    const file = join(testDir, '.stacks-channel')
    writeChannel(file, 'canary')
    expect(readChannel(file)).toBe('canary')
  })
})

// ─── resolveUpgradeMessage ───────────────────────────────────────────────────

describe('resolveUpgradeMessage', () => {
  it('should show version install message for pinned version', () => {
    const ctx = { channel: 'stable' as const, ref: 'v0.70.23', targetVersion: '0.70.23' }
    expect(resolveUpgradeMessage(ctx, 'stable', false)).toBe('Installing Stacks v0.70.23...')
  })

  it('should strip v prefix from version message', () => {
    const ctx = { channel: 'stable' as const, ref: 'v0.70.23', targetVersion: 'v0.70.23' }
    expect(resolveUpgradeMessage(ctx, 'stable', false)).toBe('Installing Stacks v0.70.23...')
  })

  it('should show canary message', () => {
    const ctx = { channel: 'canary' as const, ref: 'canary' }
    expect(resolveUpgradeMessage(ctx, 'stable', false)).toBe('Upgrading to the latest canary build...')
  })

  it('should show switch-back message when going from canary to stable', () => {
    const ctx = { channel: 'stable' as const, ref: 'main' }
    expect(resolveUpgradeMessage(ctx, 'canary', true)).toBe('Switching back to the latest stable release...')
  })

  it('should show generic upgrade message for stable-to-stable', () => {
    const ctx = { channel: 'stable' as const, ref: 'main' }
    expect(resolveUpgradeMessage(ctx, 'stable', false)).toBe('Upgrading to the latest version...')
  })

  it('should show generic upgrade message when stable flag is false even from canary', () => {
    const ctx = { channel: 'stable' as const, ref: 'main' }
    expect(resolveUpgradeMessage(ctx, 'canary', false)).toBe('Upgrading to the latest version...')
  })
})

// ─── resolveSuccessMessage ───────────────────────────────────────────────────

describe('resolveSuccessMessage', () => {
  describe('pinned version', () => {
    it('should say "already at" when version matches and no force', () => {
      const ctx = { channel: 'stable' as const, ref: 'v0.70.23', targetVersion: '0.70.23' }
      expect(resolveSuccessMessage(ctx, '0.70.23', '0.70.23', 'stable', false))
        .toBe('Stacks is already at v0.70.23')
    })

    it('should show install with previous version', () => {
      const ctx = { channel: 'stable' as const, ref: 'v0.71.0', targetVersion: '0.71.0' }
      expect(resolveSuccessMessage(ctx, '0.70.23', '0.71.0', 'stable', false))
        .toBe('Installed Stacks v0.71.0 (was v0.70.23)')
    })

    it('should show install without previous version', () => {
      const ctx = { channel: 'stable' as const, ref: 'v0.71.0', targetVersion: '0.71.0' }
      expect(resolveSuccessMessage(ctx, null, '0.71.0', 'stable', false))
        .toBe('Installed Stacks v0.71.0')
    })

    it('should force reinstall even when same version', () => {
      const ctx = { channel: 'stable' as const, ref: 'v0.70.23', targetVersion: '0.70.23' }
      expect(resolveSuccessMessage(ctx, '0.70.23', '0.70.23', 'stable', true))
        .toBe('Installed Stacks v0.70.23 (was v0.70.23)')
    })

    it('should strip v prefix from targetVersion in messages', () => {
      const ctx = { channel: 'stable' as const, ref: 'v0.70.23', targetVersion: 'v0.70.23' }
      expect(resolveSuccessMessage(ctx, null, '0.70.23', 'stable', false))
        .toBe('Installed Stacks v0.70.23')
    })
  })

  describe('stable channel', () => {
    it('should say "already up to date" when versions match', () => {
      const ctx = { channel: 'stable' as const, ref: 'main' }
      expect(resolveSuccessMessage(ctx, '0.70.23', '0.70.23', 'stable', false))
        .toBe('Stacks is already up to date (v0.70.23)')
    })

    it('should show upgrade from/to', () => {
      const ctx = { channel: 'stable' as const, ref: 'main' }
      expect(resolveSuccessMessage(ctx, '0.70.23', '0.71.0', 'stable', false))
        .toBe('Upgraded Stacks from v0.70.23 to v0.71.0')
    })

    it('should show "upgraded to" when no current version', () => {
      const ctx = { channel: 'stable' as const, ref: 'main' }
      expect(resolveSuccessMessage(ctx, null, '0.71.0', 'stable', false))
        .toBe('Upgraded Stacks to v0.71.0')
    })

    it('should show fallback when both versions are null', () => {
      const ctx = { channel: 'stable' as const, ref: 'main' }
      expect(resolveSuccessMessage(ctx, null, null, 'stable', false))
        .toBe('Upgraded Stacks to main (latest)')
    })

    it('should force upgrade even when versions match', () => {
      const ctx = { channel: 'stable' as const, ref: 'main' }
      // When force=true and versions match, it falls through to the from/to message
      expect(resolveSuccessMessage(ctx, '0.70.23', '0.70.23', 'stable', true))
        .toBe('Upgraded Stacks from v0.70.23 to v0.70.23')
    })
  })

  describe('canary channel', () => {
    it('should say "already up to date" with canary prefix when versions match', () => {
      const ctx = { channel: 'canary' as const, ref: 'canary' }
      expect(resolveSuccessMessage(ctx, '0.70.23', '0.70.23', 'canary', false))
        .toBe('Stacks is already up to date (canary 0.70.23)')
    })

    it('should show upgrade with canary labels', () => {
      const ctx = { channel: 'canary' as const, ref: 'canary' }
      expect(resolveSuccessMessage(ctx, '0.70.23', '0.71.0', 'canary', false))
        .toBe('Upgraded Stacks from canary 0.70.23 to canary 0.71.0')
    })

    it('should show "upgraded to" with canary label when no current version', () => {
      const ctx = { channel: 'canary' as const, ref: 'canary' }
      expect(resolveSuccessMessage(ctx, null, '0.71.0', 'canary', false))
        .toBe('Upgraded Stacks to canary 0.71.0')
    })
  })

  describe('cross-channel upgrades', () => {
    it('should show stable-to-canary upgrade', () => {
      const ctx = { channel: 'canary' as const, ref: 'canary' }
      expect(resolveSuccessMessage(ctx, '0.70.23', '0.71.0', 'stable', false))
        .toBe('Upgraded Stacks from v0.70.23 to canary 0.71.0')
    })

    it('should show canary-to-stable upgrade', () => {
      const ctx = { channel: 'stable' as const, ref: 'main' }
      expect(resolveSuccessMessage(ctx, '0.71.0', '0.70.23', 'canary', false))
        .toBe('Upgraded Stacks from canary 0.71.0 to v0.70.23')
    })
  })
})
