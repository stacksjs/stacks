import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export interface UpgradeContext {
  channel: 'stable' | 'canary'
  ref: string
  targetVersion?: string
}

/**
 * Resolve the target channel and git ref from CLI options and persisted channel.
 * Priority: --version > --canary > --stable > persisted channel
 */
export function resolveUpgradeContext(options: {
  version?: string
  canary?: boolean
  stable?: boolean
}, currentChannel: 'stable' | 'canary'): UpgradeContext {
  const targetVersion = options.version

  if (targetVersion) {
    // Specific version requested — use the git tag
    // Support both "0.70.23" and "v0.70.23"
    const ref = targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`
    return { channel: 'stable', ref, targetVersion }
  }

  if (options.canary) {
    return { channel: 'canary', ref: 'canary' }
  }

  if (options.stable) {
    return { channel: 'stable', ref: 'main' }
  }

  if (currentChannel === 'canary') {
    // Stay on canary if already on canary (like bun upgrade on canary stays on canary)
    return { channel: 'canary', ref: 'canary' }
  }

  return { channel: 'stable', ref: 'main' }
}

/**
 * Build the gitit template string for the framework core.
 */
export function buildTemplateString(ref: string): string {
  return `github:stacksjs/stacks#${ref}/storage/framework/core`
}

/**
 * Read a version from a package.json file. Returns null on any error.
 */
export function readVersion(pkgPath: string): string | null {
  try {
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      return pkg.version || null
    }
  }
  catch {
    // best-effort
  }

  return null
}

/**
 * Read the persisted channel from the channel file.
 */
export function readChannel(channelFilePath: string): 'stable' | 'canary' {
  try {
    if (existsSync(channelFilePath)) {
      const content = readFileSync(channelFilePath, 'utf-8').trim()
      if (content === 'canary')
        return 'canary'
    }
  }
  catch {
    // best-effort
  }

  return 'stable'
}

/**
 * Persist the channel to the channel file.
 */
export function writeChannel(channelFilePath: string, ch: 'stable' | 'canary'): void {
  try {
    writeFileSync(channelFilePath, ch, 'utf-8')
  }
  catch {
    // best-effort
  }
}

/**
 * Determine the user-facing log message for the upgrade action.
 */
export function resolveUpgradeMessage(ctx: UpgradeContext, currentChannel: 'stable' | 'canary', isStableFlag: boolean): string {
  if (ctx.targetVersion) {
    return `Installing Stacks v${ctx.targetVersion.replace(/^v/, '')}...`
  }

  if (ctx.channel === 'canary') {
    return 'Upgrading to the latest canary build...'
  }

  if (isStableFlag && currentChannel === 'canary') {
    return 'Switching back to the latest stable release...'
  }

  return 'Upgrading to the latest version...'
}

/**
 * Determine the user-facing success message after an upgrade.
 */
export function resolveSuccessMessage(ctx: UpgradeContext, currentVersion: string | null, newVersion: string | null, currentChannel: 'stable' | 'canary', force: boolean): string {
  if (ctx.targetVersion) {
    const pinned = ctx.targetVersion.replace(/^v/, '')

    if (currentVersion === pinned && !force) {
      return `Stacks is already at v${pinned}`
    }

    if (currentVersion) {
      return `Installed Stacks v${pinned} (was v${currentVersion})`
    }

    return `Installed Stacks v${pinned}`
  }

  if (currentVersion && newVersion && currentVersion === newVersion && !force) {
    if (ctx.channel === 'canary') {
      return `Stacks is already up to date (canary ${currentVersion})`
    }

    return `Stacks is already up to date (v${currentVersion})`
  }

  if (currentVersion && newVersion) {
    const from = currentChannel === 'canary' ? `canary ${currentVersion}` : `v${currentVersion}`
    const to = ctx.channel === 'canary' ? `canary ${newVersion}` : `v${newVersion}`
    return `Upgraded Stacks from ${from} to ${to}`
  }

  if (newVersion) {
    const label = ctx.channel === 'canary' ? `canary ${newVersion}` : `v${newVersion}`
    return `Upgraded Stacks to ${label}`
  }

  return `Upgraded Stacks to ${ctx.ref} (latest)`
}
