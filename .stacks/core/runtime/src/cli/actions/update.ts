import { log, prompts, runCommand, spawn } from '@stacksjs/cli'
import storage from '@stacksjs/storage'
import { determineDebugMode } from '@stacksjs/config'
import { frameworkPath, projectPath } from '@stacksjs/path'
import type { UpdateOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'

export async function invoke(options?: UpdateOptions) {
  if (options?.framework || options?.all)
    await updateFramework(options)

  if (options?.dependencies || options?.all)
    await updateDependencies(options)

  if (options?.packageManager || options?.all)
    await updatePackageManager(options)

  if (options?.node || options?.all)
    await updateNode(options)

  else
    process.exit(ExitCode.InvalidArgument)

  // TODO: also update CI files & configurations, and other files, possibly
  // we want this to be smart enough to update only if files that have been updated
  // TODO: this script should trigger regeneration of auto-imports.d.ts & components.d.ts
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function update(options: UpdateOptions) {
  return await invoke(options)
}

export async function checkForUncommittedChanges(path = './.stacks', options: UpdateOptions) {
  try {
    const stdio = determineDebugMode(options) ? 'inherit' : 'ignore'

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
        const answer = await prompts.confirm({
          type: 'select',
          name: 'framework-update',
          message: 'We detected there are uncommitted in the ./stacks folder. Do you want to overwrite those?',
        })

        // @ts-expect-error the answer object type expects to return a void type but it returns boolean
        if (!answer) {
          log.info('Aborted. Stacks did not update itself.')
          log.info('Note: if you commit your changes and replay the update, you can see what changed.')
          process.exit(ExitCode.Success)
        }
      }
    }
  }
}

export async function updateFramework(options: UpdateOptions) {
  const debug = determineDebugMode(options)

  await checkForUncommittedChanges('./.stacks', options)
  await downloadFrameworkUpdate(options)

  log.info('Updating framework...')

  const exclude = ['functions/package.json', 'components/vue/package.json', 'components/web/package.json', 'auto-imports.d.ts', 'components.d.ts', 'dist']
  await storage.deleteFiles(frameworkPath(), exclude)

  // loop 5 times to make sure all "deep empty" folders are deleted
  for (let i = 0; i < 5; i++)
    await storage.deleteEmptyFolders(frameworkPath())

  await storage.copyFolder(frameworkPath(), projectPath('./updates/.stacks'), exclude)

  if (debug === 'inherit')
    log.info('Cleanup...')

  await storage.deleteFolder(projectPath('updates'))
  log.success('Framework updated')
}

export async function downloadFrameworkUpdate(options: UpdateOptions) {
  const tempFolderName = 'updates'
  const tempUpdatePath = projectPath(tempFolderName)

  if (storage.doesFolderExist(tempUpdatePath))
    await deleteFolder(tempUpdatePath)

  log.info('Downloading framework updates...')
  await runCommand(`giget stacks ${tempFolderName}`, options)
  const version = (await storage.readJsonFile(projectPath(`${tempFolderName}/.stacks/version`))).data
  log.success('Your framework updated correctly to version: ', version)
}

export async function updateDependencies(options: UpdateOptions) {
  try {
    log.info('Preparing to update dependencies.')
    await runCommand('pnpm update', options)
    log.success('Freshly updated your dependencies.')
  }
  catch (error) {
    log.error('There was an error updating your dependencies.')
    log.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function updatePackageManager(options: UpdateOptions) {
  log.info('Preparing to update the package manager.')
  const version = options?.version || 'latest'
  await runCommand(`corepack prepare pnpm@${version} --activate`, options)
  log.success('Updated to version:', version)
}

export async function updateNode(options: UpdateOptions) {
  log.info('Preparing your Node version update.')
  await runCommand('fnm use', options)
  log.success('Your Node version is now:', process.version)
}
