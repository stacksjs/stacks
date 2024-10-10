import type { UpgradeOptions } from '@stacksjs/types'
import process from 'node:process'
import { intro, outro, runCommand } from '@stacksjs/cli'
import { NpmScript } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import * as storage from '@stacksjs/storage'
import { version } from '../package.json'

// import { determineDebugLevel } from '@stacksjs/utils'

// export async function checkForUncommittedChanges(path = './stacks', options: UpgradeOptions) {
export function checkForUncommittedChanges(options: UpgradeOptions): void {
  try {
    console.log('checkForUncommittedChanges', options)
    // const stdio = determineDebugLevel(options) ? 'inherit' : 'ignore'
    // check if the stacks folder has any updates
    // https://carlosbecker.com/posts/git-changed/
    // await spawn(`git diff --quiet HEAD -- ${path}`, { stdio, cwd: projectPath() })
  }
  catch (error: any) {
    console.error(error)
    // if (error.status === 1) {
    // even though the ./stacks folder should not be edited, instead config values should be adjusted,
    // there is a chance that users may apply local core edits, as it’s totally acceptable, as long as
    // the user knows what they are doing. There is also a change that simply the deps within stacks
    // folder have been updated and that could produce a diff.
    // if (!options?.force) {
    // const confirmed = await log.prompt('We detected there are uncommitted in the ./stacks folder. Do you want to overwrite those?', {
    //   type: 'confirm',
    // })
    // if (!confirmed) {
    //   log.info('Aborted. Stacks did not update itself.')
    //   log.info('Note: if you commit your changes and replay the update, you can see what changed.')
    //   process.exit(ExitCode.Success)
    // }
    //   }
    // }
  }
}

export async function downloadFrameworkUpdate(options: UpgradeOptions): Promise<void> {
  const tempFolderName = 'updates'
  const tempUpdatePath = projectPath(tempFolderName)

  if (storage.doesFolderExist(tempUpdatePath))
    await storage.deleteFolder(tempUpdatePath)

  log.info('Downloading framework updates...')
  await runCommand(`giget stacks ${tempFolderName}`, options)
  log.success(`Your framework updated correctly to version: v${version}`)
}

// export async function updateDependencies(options: UpgradeOptions) {
export async function updateDependencies(): Promise<void> {
  const perf = await intro('buddy upgrade:dependencies')
  const result = await runCommand(NpmScript.UpgradeDependencies, {
    cwd: projectPath(),
  })

  if (result.isErr()) {
    await outro(
      'While running the upgrade:dependencies command, there was an issue',
      { startTime: perf, useSeconds: true },
      result.error,
    )
    process.exit()
  }

  await outro('Freshly updated your dependencies.', {
    startTime: perf,
    useSeconds: true,
  })
  process.exit()
}
