import type { CommandError, UpgradeOptions } from '@stacksjs/types'
import type { Result } from '@stacksjs/error-handling'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Action } from '@stacksjs/enums'
import { ok } from '@stacksjs/error-handling'
import { projectPath } from '@stacksjs/path'
import { print } from '@stacksjs/cli'
import { runAction, runActionSequence } from '../helpers'
import { upgradeStacksPackages } from './packages'
import { previewFrameworkUpgrade } from './framework-preview'
import { upgradeToolPreview } from './tool-preview'

/** Shared by the CLI and script dispatcher; the invoking release owns selection. */
export async function runUpgrade(options: UpgradeOptions): Promise<Result<void, CommandError>> {
  const stages = [
    [options.framework, Action.UpgradeFramework],
    [options.dependencies, Action.UpgradeDeps],
    [options.bun, Action.UpgradeBun],
    [options.shell, Action.UpgradeShell],
    [options.binary, Action.UpgradeBinary],
  ] as const
  const actions = stages.filter(([selected]) => selected || options.all).map(([, action]) => action)
  if (!actions.length)
    return ok<void, CommandError>(undefined)

  return runActionSequence(actions, options, async (action, stageOptions) => {
    const root = options.cwd ? String(options.cwd) : projectPath()
    if (options.dryRun) {
      // Preview is owned by this release. A project's older action bodies may
      // ignore dryRun, and framework preview does not replace those bodies.
      if (action === Action.UpgradeFramework) {
        if (existsSync(join(root, 'storage/framework/core')))
          await previewFrameworkUpgrade(root, options)
        else
          await upgradeStacksPackages(root, options)
      }
      else {
        print(upgradeToolPreview(action))
      }
      return ok<void, CommandError>(undefined)
    }
    if (action === Action.UpgradeFramework && !existsSync(join(root, 'storage/framework/core'))) {
      // Bootstrap with the invoking release, then let the freshly installed
      // target own migrations. An old project's action registry cannot do it.
      await upgradeStacksPackages(root, options)
      return ok<void, CommandError>(undefined)
    }
    return (await runAction(action, stageOptions)).map(() => {})
  })
}
