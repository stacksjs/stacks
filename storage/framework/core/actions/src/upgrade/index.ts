import process from 'node:process'
import { ExitCode, parseArgs } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { runAction } from '../helpers'

const options = parseArgs()

// run all the upgrade actions
if (options?.framework || options?.all)
  await updateFramework(options)

if (options?.dependencies || options?.all)
  await updateDependencies(options)

if (options?.bun || options?.all)
  await runAction(Action.UpgradeBun, options)

process.exit(ExitCode.InvalidArgument)

// TODO: also update CI files & configurations, and other files, possibly (taze?)
// we want this to be smart enough to update only if files that have been updated
