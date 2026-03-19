import { copyFileSync, existsSync, rmSync } from 'node:fs'
import process from 'node:process'
import { parseOptions } from '@stacksjs/cli'
import { downloadTemplate } from '@stacksjs/gitit'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import {
  buildTemplateString,
  readChannel,
  readVersion,
  resolveSuccessMessage,
  resolveUpgradeContext,
  resolveUpgradeMessage,
  writeChannel,
} from './framework-utils'

const options = parseOptions() as { version?: string, canary?: boolean, stable?: boolean, force?: boolean }

const channelFile = p.projectPath('.stacks-channel')
const currentChannel = readChannel(channelFile)
const ctx = resolveUpgradeContext(options, currentChannel)

const targetDir = p.projectPath('storage/framework/core')
const currentVersion = readVersion(`${targetDir}/buddy/package.json`)

log.info(resolveUpgradeMessage(ctx, currentChannel, !!options?.stable))

try {
  const template = buildTemplateString(ctx.ref)

  // eslint-disable-next-line pickier/no-unused-vars
  const result = await downloadTemplate(template, {
    dir: targetDir,
    force: true,
    forceClean: false,
    preferOffline: !options?.force,
  })

  const newVersion = readVersion(`${targetDir}/buddy/package.json`)

  // Persist channel choice (not when pinning a specific version)
  if (!ctx.targetVersion)
    writeChannel(channelFile, ctx.channel)

  log.success(resolveSuccessMessage(ctx, currentVersion, newVersion, currentChannel, !!options?.force))

  if (ctx.channel === 'canary' && !ctx.targetVersion) {
    log.warn('Canary builds may contain bugs or breaking changes. Not recommended for production.')
  }

  // Best-effort: update root-level scripts that may have changed
  updateRootFiles(ctx.ref)
}
catch (err: any) {
  log.error('Failed to upgrade Stacks framework', err.message || err)
  process.exit(ExitCode.FatalError)
}

function updateRootFiles(branch: string): void {
  const tmpDir = p.projectPath('.tmp-upgrade')

  downloadTemplate(`github:stacksjs/stacks#${branch}`, {
    dir: tmpDir,
    force: true,
    forceClean: true,
    preferOffline: true,
    silent: true,
  }).then(() => {
    const rootFiles = ['buddy', 'pantry/bootstrap']

    for (const file of rootFiles) {
      try {
        const src = `${tmpDir}/${file}`
        const dest = p.projectPath(file)

        if (existsSync(src) && existsSync(dest))
          copyFileSync(src, dest)
      }
      catch {
        // Non-critical file copy failure
      }
    }
  }).catch(() => {
    // Non-critical — root file updates are best-effort
  }).finally(() => {
    if (existsSync(tmpDir))
      rmSync(tmpDir, { recursive: true, force: true })
  })
}
