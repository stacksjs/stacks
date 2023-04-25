import { intro, log, outro, prompt, runCommand, spawn } from '@stacksjs/cli'
import storage from '@stacksjs/storage'
import { determineDebugLevel } from '@stacksjs/utils'
import { projectPath } from '@stacksjs/path'
import type { UpgradeOptions } from '@stacksjs/types'
import { ExitCode, NpmScript } from '@stacksjs/types'

export async function checkForUncommittedChanges(path = './.stacks', options: UpgradeOptions) {
  try {
    const stdio = determineDebugLevel(options) ? 'inherit' : 'ignore'

    // check if the .stacks folder has any updates
    // https://carlosbecker.com/posts/git-changed/
    await spawn(`git diff --quiet HEAD -- ${path}`, { stdio, cwd: projectPath() })
  }
  catch (error: any) {
    if (error.status === 1) {
      // even though the ./.stacks folder should not be edited, instead config values should be adjusted,
      // there is a chance that users may apply local core edits, as it's totally acceptable, as long as
      // the user knows what they are doing. There is also a change that simply the deps within .stacks
      // folder have been updated and that could produce a diff.
      if (!options?.force) {
        const confirmed = await prompt('We detected there are uncommitted in the ./stacks folder. Do you want to overwrite those?', {
          type: 'confirm',
        })

        if (!confirmed) {
          log.info('Aborted. Stacks did not update itself.')
          log.info('Note: if you commit your changes and replay the update, you can see what changed.')
          process.exit(ExitCode.Success)
        }
      }
    }
  }
}

export async function downloadFrameworkUpdate(options: UpgradeOptions) {
  const tempFolderName = 'updates'
  const tempUpdatePath = projectPath(tempFolderName)

  if (storage.doesFolderExist(tempUpdatePath))
    await deleteFolder(tempUpdatePath)

  log.info('Downloading framework updates...')
  await runCommand(`giget stacks ${tempFolderName}`, options)
  const version = (await storage.readJsonFile(projectPath(`${tempFolderName}/.stacks/version`))).data
  log.success('Your framework updated correctly to version: ', version)
}

export async function updateDependencies(options: UpgradeOptions) {
  const perf = await intro('buddy upgrade:dependencies')
  const result = await runCommand(NpmScript.UpgradeDependencies, options)

  if (result.isErr()) {
    outro('While running the upgrade:dependencies command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
    process.exit()
  }

  outro('Freshly updated your dependencies.', { startTime: perf, useSeconds: true })
  process.exit()
}

export async function updatePackageManager(options: UpgradeOptions) {
  const perf = await intro('buddy upgrade:package-manager')
  const version = options?.version || 'latest'
  const result = await runCommand(`corepack prepare pnpm@${version} --activate`, options)

  if (result.isErr()) {
    outro('While running the upgrade:package-manager command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
    process.exit()
  }

  outro(`Updated to version: ${version}`, { startTime: perf, useSeconds: true })
  process.exit()
}
