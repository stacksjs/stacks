import process from 'node:process'
import { parseArgs } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'
import { runAction } from '../helpers'

const options: any = parseArgs()

// run all the upgrade actions
// if (options?.framework || options?.all)
//   await updateFramework(options)

if (options?.dependencies || options?.all)
  await runAction(Action.UpgradeDeps, options)

if (options?.bun || options?.all)
  await runAction(Action.UpgradeBun, options)

if (options?.shell || options?.all)
  await runAction(Action.UpgradeShell, options)

if (options?.binary || options?.all)
  await runAction(Action.UpgradeBinary, options)

process.exit(ExitCode.InvalidArgument)

// TODO: also update CI files & configurations, and other files, possibly (taze?)
// we want this to be smart enough to update only if files that have been updated
