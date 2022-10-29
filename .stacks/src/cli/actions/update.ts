import { Prompts, consola, spawn } from '@stacksjs/cli'
import storage from '@stacksjs/storage'
import { debugLevel } from '@stacksjs/config'
import { frameworkPath, projectPath } from '@stacksjs/path'
import type { UpdateOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'

const { prompts } = Prompts

export async function stacks(options?: UpdateOptions) {
  if (options?.framework || options?.all)
    await updateFramework(options)

  if (options?.dependencies || options?.all)
    await updateDependencies(options)

  if (options?.packageManager || options?.all)
    await updatePackageManager(options)

  if (options?.node || options?.all)
    await updateNode(options)

  // TODO: also update CI files & configurations, and other files, possibly
  // we want this to be smart enough to update only if files that have been updated
  // TODO: this script should trigger regeneration of auto-imports.d.ts & components.d.ts
}

async function checkForUncommittedChanges(path = './.stacks', options: UpdateOptions) {
  try {
    const debug = debugLevel(options)

    // check if the .stacks folder has any updates
    // https://carlosbecker.com/posts/git-changed/
    await spawn.async(`git diff --quiet HEAD -- ${path}`, { stdio: debug, cwd: projectPath() })
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
          consola.info('Aborted. Stacks did not update itself.')
          consola.info('Note: if you commit your changes and replay the update, you can see what changed.')
          process.exit(ExitCode.Success)
        }
      }
    }
  }
}

async function updateFramework(options: UpdateOptions) {
  const debug = debugLevel(options)

  await checkForUncommittedChanges('./.stacks', options)
  await downloadFrameworkUpdate(options)

  consola.info('Updating framework...')

  const exclude = ['functions/package.json', 'components/vue/package.json', 'components/web/package.json', 'auto-imports.d.ts', 'components.d.ts', 'dist']
  await storage.deleteFiles(frameworkPath(), exclude)

  // loop 5 times to make sure all "deep empty" folders are deleted
  for (let i = 0; i < 5; i++)
    await storage.deleteEmptyFolders(frameworkPath())

  const from = projectPath('./updates/.stacks')
  const to = frameworkPath()
  await storage.copyFolder(from, to, exclude)

  if (debug === 'inherit')
    consola.info('Cleanup...')

  await storage.deleteFolder(projectPath('updates'))
  consola.success('Framework updated')
}

async function downloadFrameworkUpdate(options: UpdateOptions) {
  const debug = debugLevel(options)

  consola.info('Downloading framework updates...')

  const tempFolderName = 'updates'
  const tempUpdatePath = projectPath(tempFolderName)

  if (storage.doesFolderExist(tempUpdatePath))
    await deleteFolder(tempUpdatePath)

  await spawn.async(`giget stacks ${tempFolderName}`, { stdio: debug })
  consola.success('Downloaded framework updates.')
}

async function updateDependencies(options: UpdateOptions) {
  const debug = debugLevel(options)
  consola.info('Updating dependencies...')
  await spawn.async('pnpm update', { stdio: debug, cwd: projectPath() })
  consola.success('Updated dependencies.')
}

async function updatePackageManager(options: UpdateOptions) {
  const debug = debugLevel(options)
  consola.info('Updating package manager...')
  const version = options?.version || 'latest'
  await spawn.async(`corepack prepare pnpm@${version} --activate`, { stdio: debug, cwd: projectPath() })
  consola.success('Successfully updated to:', version)
}

async function updateNode(options: UpdateOptions) {
  const debug = debugLevel(options)
  consola.info('Ensuring the proper Node version is used...')
  await spawn.async('fnm use', { stdio: debug, cwd: projectPath() })
  consola.success('Your Node version is now:', process.version)
}
