import { Prompts, consola, spawn } from '@stacksjs/cli'
import fs from '@stacksjs/storage'
import { debugLevel } from '@stacksjs/config'
import { frameworkPath, projectPath } from '@stacksjs/path'
import { ExitCode, type UpdateOptions } from '@stacksjs/types'

const { prompts } = Prompts

export async function stacks(options?: UpdateOptions) {
  const debug = debugLevel(options)

  // first, we need to update the framework, if updates available
  if (options?.framework || options?.all) {
    try {
      // check if the .stacks folder has any updates
      // https://carlosbecker.com/posts/git-changed/
      await spawn.async('git diff --quiet HEAD -- ./.stacks', { stdio: debug, cwd: projectPath() })
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

    consola.info('Downloading framework updates...')

    const tempFolderName = 'updates'
    const tempUpdatePath = projectPath(tempFolderName)

    if (fs.doesFolderExist(tempUpdatePath))
      await deleteFolder(tempUpdatePath)

    await spawn.async(`giget stacks ${tempFolderName}`, { stdio: debug })
    consola.success('Downloaded framework updates')

    const exclude = ['functions/package.json', 'components/vue/package.json', 'components/web/package.json', 'auto-imports.d.ts', 'components.d.ts', 'dist']

    consola.info('Updating framework...')
    await fs.deleteFiles(frameworkPath(), exclude)

    // loop 5 times to make sure all "deep empty" folders are deleted
    for (let i = 0; i < 5; i++)
      await fs.deleteEmptyFolders(frameworkPath())

    const from = projectPath('./updates/.stacks')
    const to = frameworkPath()

    await fs.copyFolder(from, to, exclude)

    consola.info('Cleanup...')
    await fs.deleteFolder(tempUpdatePath)
    consola.success('Framework updated')
  }

  // then, we need to update the project's & framework's dependencies, if updates available
  if (options?.dependencies || options?.all) {
    consola.info('Updating dependencies...')
    await spawn.async('pnpm update', { stdio: debug, cwd: projectPath() })
    consola.success('Updated dependencies.')
  }

  // this condition checks whether pnpm needs to be updated
  if (options?.packageManager || options?.all) {
    consola.info('Updating package manager...')
    const version = options?.version || 'latest'
    await spawn.async(`corepack prepare pnpm@${version} --activate`, { stdio: debug, cwd: projectPath() })
    consola.success('Successfully updated to:', version)
  }

  // this condition checks whether Node needs to be updated
  if (options?.node || options?.all) {
    consola.info('Ensuring the proper Node version is used...')
    await spawn.async('fnm use', { stdio: debug, cwd: projectPath() })
    consola.success('Your Node version is now:', process.version)
  }

  // TODO: also update CI files & configurations, and other files, possibly
  // we want this to be smart enough to update only if files that have been updated
  // TODO: this script should trigger regeneration of auto-imports.d.ts & components.d.ts
}
