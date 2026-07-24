import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const {
  resolveUpgradeContext,
  pickLatestStableTag,
  buildTemplateString,
  readVersion,
  readChannel,
  writeChannel,
  readSyncedVersion,
  writeSyncedVersion,
  shouldShortCircuit,
  resolveUpgradeMessage,
  resolveSuccessMessage,
  shouldAutoDetectLocalStacks,
  shouldCheckDirtyManagedPaths,
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

// The resolved latest stable tag is passed into resolveUpgradeContext (the
// network lookup lives in the async caller). Tests inject a fixture tag so the
// pure resolution stays deterministic.
const STABLE = 'v9.9.9'

describe('resolveUpgradeContext', () => {
  describe('default behavior', () => {
    it('should default to the stable channel + latest stable tag when no options and channel is stable', () => {
      const ctx = resolveUpgradeContext({}, 'stable', STABLE)
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe(STABLE)
      expect(ctx.targetVersion).toBeUndefined()
    })

    it('should stay on canary (main branch) if current channel is canary and no flags', () => {
      const ctx = resolveUpgradeContext({}, 'canary', STABLE)
      expect(ctx.channel).toBe('canary')
      expect(ctx.ref).toBe('main')
      expect(ctx.targetVersion).toBeUndefined()
    })
  })

  describe('--canary flag', () => {
    it('should switch to canary (main branch) when --canary is set', () => {
      const ctx = resolveUpgradeContext({ canary: true }, 'stable', STABLE)
      expect(ctx.channel).toBe('canary')
      expect(ctx.ref).toBe('main')
    })

    it('should stay on canary (main branch) when already on canary and --canary is set', () => {
      const ctx = resolveUpgradeContext({ canary: true }, 'canary', STABLE)
      expect(ctx.channel).toBe('canary')
      expect(ctx.ref).toBe('main')
    })
  })

  describe('--stable flag', () => {
    it('should switch to the latest stable tag when --stable is set from canary', () => {
      const ctx = resolveUpgradeContext({ stable: true }, 'canary', STABLE)
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe(STABLE)
    })

    it('should stay on the latest stable tag when already stable and --stable is set', () => {
      const ctx = resolveUpgradeContext({ stable: true }, 'stable', STABLE)
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe(STABLE)
    })
  })

  describe('--version flag', () => {
    it('should use version tag without v prefix', () => {
      const ctx = resolveUpgradeContext({ version: '0.70.23' }, 'stable', STABLE)
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe('v0.70.23')
      expect(ctx.targetVersion).toBe('0.70.23')
    })

    it('should use version tag with v prefix as-is', () => {
      const ctx = resolveUpgradeContext({ version: 'v0.70.23' }, 'stable', STABLE)
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe('v0.70.23')
      expect(ctx.targetVersion).toBe('v0.70.23')
    })

    it('should take priority over --canary', () => {
      const ctx = resolveUpgradeContext({ version: '0.70.23', canary: true }, 'stable', STABLE)
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe('v0.70.23')
      expect(ctx.targetVersion).toBe('0.70.23')
    })

    it('should take priority over --stable', () => {
      const ctx = resolveUpgradeContext({ version: '0.70.23', stable: true }, 'canary', STABLE)
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe('v0.70.23')
    })

    it('should take priority over persisted canary channel', () => {
      const ctx = resolveUpgradeContext({ version: '0.70.23' }, 'canary', STABLE)
      expect(ctx.channel).toBe('stable')
      expect(ctx.ref).toBe('v0.70.23')
    })

    it('should handle semver-only strings', () => {
      const ctx = resolveUpgradeContext({ version: '1.0.0' }, 'stable', STABLE)
      expect(ctx.ref).toBe('v1.0.0')
    })

    it('should handle pre-release version strings', () => {
      const ctx = resolveUpgradeContext({ version: '1.0.0-beta.1' }, 'stable', STABLE)
      expect(ctx.ref).toBe('v1.0.0-beta.1')
    })
  })

  describe('flag priority', () => {
    it('--version beats --canary beats --stable beats persisted channel', () => {
      // version > canary
      const v = resolveUpgradeContext({ version: '1.0.0', canary: true, stable: true }, 'canary', STABLE)
      expect(v.ref).toBe('v1.0.0')

      // canary > stable (when no version)
      const c = resolveUpgradeContext({ canary: true, stable: true }, 'stable', STABLE)
      expect(c.channel).toBe('canary')

      // stable > persisted canary (when no version/canary)
      const s = resolveUpgradeContext({ stable: true }, 'canary', STABLE)
      expect(s.channel).toBe('stable')
      expect(s.ref).toBe(STABLE)
    })
  })
})

// ─── pickLatestStableTag ─────────────────────────────────────────────────────

describe('pickLatestStableTag', () => {
  it('picks the highest vX.Y.Z tag by semver, not lexically', () => {
    expect(pickLatestStableTag(['v0.70.9', 'v0.70.162', 'v0.70.52', 'v0.9.99'])).toBe('v0.70.162')
  })

  it('compares major/minor/patch numerically', () => {
    expect(pickLatestStableTag(['v1.0.0', 'v0.99.99', 'v1.2.0', 'v1.10.0'])).toBe('v1.10.0')
  })

  it('ignores pre-releases, deref entries, and non-version tags', () => {
    expect(pickLatestStableTag([
      'v0.70.163-beta.1',
      'v0.70.163^{}',
      'latest',
      'browser-extension-v2.0.0',
      'v0.70.162',
    ])).toBe('v0.70.162')
  })

  it('trims whitespace around tags', () => {
    expect(pickLatestStableTag(['  v0.70.10  ', 'v0.70.2'])).toBe('v0.70.10')
  })

  it('returns null when no clean version tag qualifies', () => {
    expect(pickLatestStableTag(['latest', 'v1.0.0-rc.1', ''])).toBeNull()
    expect(pickLatestStableTag([])).toBeNull()
  })
})

describe('local framework source selection', () => {
  it('does not auto-detect a checkout for an exact version pin', () => {
    expect(shouldAutoDetectLocalStacks({ version: '0.70.104' })).toBe(false)
  })

  it('auto-detects for channel upgrades and respects explicit --from', () => {
    expect(shouldAutoDetectLocalStacks({})).toBe(true)
    expect(shouldAutoDetectLocalStacks({ from: '/tmp/stacks' })).toBe(false)
    expect(shouldAutoDetectLocalStacks({ from: '/tmp/stacks', version: '0.70.104' })).toBe(false)
  })
})

// ─── buildTemplateString ─────────────────────────────────────────────────────

describe('buildTemplateString', () => {
  it('should build template for main branch', () => {
    expect(buildTemplateString('main'))
      .toBe('github:stacksjs/stacks/storage/framework/core#main')
  })

  it('should build template for canary branch', () => {
    expect(buildTemplateString('canary'))
      .toBe('github:stacksjs/stacks/storage/framework/core#canary')
  })

  it('should build template for a version tag', () => {
    expect(buildTemplateString('v0.70.23'))
      .toBe('github:stacksjs/stacks/storage/framework/core#v0.70.23')
  })

  it('should build template for a pre-release tag', () => {
    expect(buildTemplateString('v1.0.0-beta.1'))
      .toBe('github:stacksjs/stacks/storage/framework/core#v1.0.0-beta.1')
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

// ─── readSyncedVersion / writeSyncedVersion ──────────────────────────────────

const SHA_A = 'a'.repeat(40)
const SHA_B = 'b'.repeat(40)

describe('readSyncedVersion', () => {
  it('should return null when the file does not exist (first run)', () => {
    expect(readSyncedVersion(join(testDir, 'nonexistent'))).toBeNull()
  })

  it('should parse "stable <sha>"', () => {
    const file = join(testDir, '.stacks-version')
    writeFileSync(file, `stable ${SHA_A}`)
    expect(readSyncedVersion(file)).toEqual({ channel: 'stable', sha: SHA_A })
  })

  it('should parse "canary <sha>"', () => {
    const file = join(testDir, '.stacks-version')
    writeFileSync(file, `canary ${SHA_B}`)
    expect(readSyncedVersion(file)).toEqual({ channel: 'canary', sha: SHA_B })
  })

  it('should lowercase an uppercase sha', () => {
    const file = join(testDir, '.stacks-version')
    writeFileSync(file, `stable ${SHA_A.toUpperCase()}`)
    expect(readSyncedVersion(file)).toEqual({ channel: 'stable', sha: SHA_A })
  })

  it('should tolerate extra whitespace and a trailing newline', () => {
    const file = join(testDir, '.stacks-version')
    writeFileSync(file, `  canary   ${SHA_A}  \n`)
    expect(readSyncedVersion(file)).toEqual({ channel: 'canary', sha: SHA_A })
  })

  it('should return null for a malformed (too short) sha', () => {
    const file = join(testDir, '.stacks-version')
    writeFileSync(file, 'stable abc')
    expect(readSyncedVersion(file)).toBeNull()
  })

  it('should return null for an unknown channel', () => {
    const file = join(testDir, '.stacks-version')
    writeFileSync(file, `beta ${SHA_A}`)
    expect(readSyncedVersion(file)).toBeNull()
  })

  it('should return null for a bare sha (legacy format)', () => {
    const file = join(testDir, '.stacks-version')
    writeFileSync(file, SHA_A)
    expect(readSyncedVersion(file)).toBeNull()
  })

  it('should return null for an empty file', () => {
    const file = join(testDir, '.stacks-version')
    writeFileSync(file, '')
    expect(readSyncedVersion(file)).toBeNull()
  })
})

describe('writeSyncedVersion', () => {
  it('should write "stable <sha>"', () => {
    const file = join(testDir, '.stacks-version')
    writeSyncedVersion(file, 'stable', SHA_A)
    expect(readFileSync(file, 'utf-8')).toBe(`stable ${SHA_A}`)
  })

  it('should round-trip through readSyncedVersion', () => {
    const file = join(testDir, '.stacks-version')
    writeSyncedVersion(file, 'canary', SHA_B)
    expect(readSyncedVersion(file)).toEqual({ channel: 'canary', sha: SHA_B })
  })

  it('should not throw when the directory does not exist', () => {
    const file = join(testDir, 'nonexistent-dir', '.stacks-version')
    expect(() => writeSyncedVersion(file, 'stable', SHA_A)).not.toThrow()
  })
})

// ─── shouldShortCircuit ──────────────────────────────────────────────────────

describe('shouldCheckDirtyManagedPaths', () => {
  it('protects direct upgrades unless the user explicitly forces them', () => {
    expect(shouldCheckDirtyManagedPaths({ force: false, alreadyRestarted: false })).toBe(true)
    expect(shouldCheckDirtyManagedPaths({ force: true, alreadyRestarted: false })).toBe(false)
  })

  it('trusts managed writes made by the validated parent process', () => {
    expect(shouldCheckDirtyManagedPaths({ force: false, alreadyRestarted: true })).toBe(false)
  })
})

describe('shouldShortCircuit', () => {
  it('should short-circuit when sha + channel match and no flags', () => {
    expect(shouldShortCircuit({
      force: false,
      targetVersion: undefined,
      remoteSha: SHA_A,
      synced: { channel: 'stable', sha: SHA_A },
      channel: 'stable',
    })).toBe(true)
  })

  it('should match a remote sha case-insensitively', () => {
    expect(shouldShortCircuit({
      force: false,
      targetVersion: undefined,
      remoteSha: SHA_A.toUpperCase(),
      synced: { channel: 'stable', sha: SHA_A },
      channel: 'stable',
    })).toBe(true)
  })

  it('should NOT short-circuit on a channel switch even when shas are equal', () => {
    expect(shouldShortCircuit({
      force: false,
      targetVersion: undefined,
      remoteSha: SHA_A,
      synced: { channel: 'stable', sha: SHA_A },
      channel: 'canary',
    })).toBe(false)
  })

  it('should NOT short-circuit with --force', () => {
    expect(shouldShortCircuit({
      force: true,
      targetVersion: undefined,
      remoteSha: SHA_A,
      synced: { channel: 'stable', sha: SHA_A },
      channel: 'stable',
    })).toBe(false)
  })

  it('should NOT short-circuit with a pinned --version', () => {
    expect(shouldShortCircuit({
      force: false,
      targetVersion: '0.70.23',
      remoteSha: SHA_A,
      synced: { channel: 'stable', sha: SHA_A },
      channel: 'stable',
    })).toBe(false)
  })

  it('should NOT short-circuit when the remote sha is null (network/git failure)', () => {
    expect(shouldShortCircuit({
      force: false,
      targetVersion: undefined,
      remoteSha: null,
      synced: { channel: 'stable', sha: SHA_A },
      channel: 'stable',
    })).toBe(false)
  })

  it('should NOT short-circuit on first run (no persisted sync)', () => {
    expect(shouldShortCircuit({
      force: false,
      targetVersion: undefined,
      remoteSha: SHA_A,
      synced: null,
      channel: 'stable',
    })).toBe(false)
  })

  it('should NOT short-circuit when the sha differs', () => {
    expect(shouldShortCircuit({
      force: false,
      targetVersion: undefined,
      remoteSha: SHA_B,
      synced: { channel: 'stable', sha: SHA_A },
      channel: 'stable',
    })).toBe(false)
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
