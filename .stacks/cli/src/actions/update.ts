import * as ezSpawn from '@jsdevtools/ez-spawn'
import consola from 'consola'
import Prompts from 'prompts'
import { resolve } from 'pathe'
import { copyFolder, deleteEmptyFolders, deleteFiles, deleteFolder, doesFolderExist, runNpmScript } from '@stacksjs/utils'
import { NpmScript } from '@stacksjs/types'
import { ExitCode } from '../commands/exit-code'

const { prompts } = Prompts

export async function stacks(options: any) {
  // first, we need to update the framework, if updates available
  // TODO: need to delete all files except the whitelisted ones
  if (options.framework) {
    try {
      // check if the .stacks folder has any updates
      // https://carlosbecker.com/posts/git-changed/
      await ezSpawn.async('git diff --quiet HEAD -- ./.stacks', { stdio: 'inherit', cwd: process.cwd() })
    }
    catch (error: any) {
      if (error.status === 1) {
        // even though the ./.stacks folder should not be edited, instead config values should be adjusted,
        // there is a chance that users may apply local core edits, as it's totally acceptable, as long as
        // the user knows what they are doing. There is also a change that simply the deps within .stacks
        // folder have been updated and that could produce a diff.
        if (!options.force) {
          const answer = await prompts.confirm({
            type: 'select',
            name: 'framework-update',
            message: 'Would you like to overwrite your ./stacks changes in favor of the Stacks update?',
          })

          // @ts-expect-error the answer object type expects to return a void type but it returns boolean
          if (!answer) {
            consola.info('The framework was not updated.')
            consola.info('Note: if you commit your changes and replay the update, you will see what has changed.')
            process.exit(ExitCode.Success)
          }
        }
      }
    }

    consola.info('Downloading framework updates...')

    const tempFolderName = 'updates'
    const tempUpdatePath = resolve(process.cwd(), tempFolderName)
    if (doesFolderExist(tempUpdatePath))
      await deleteFolder(tempUpdatePath)

    await ezSpawn.async(`giget stacks ${tempFolderName}`, { stdio: options.debug ? 'inherit' : 'ignore' }) // TODO: stdio should inherit when APP_DEBUG or debug flag is true
    consola.success('Downloaded framework updates.')

    consola.info('Updating framework...')

    const frameworkPath = resolve(process.cwd(), '.stacks')
    const exclude = ['functions/package.json', 'vue-components/package.json', 'web-components/package.json', 'auto-imports.d.ts', 'components.d.ts', 'dist']

    await deleteFiles(frameworkPath, exclude)

    // loop 5 times to make sure all "deep empty" folders are deleted
    for (let i = 0; i < 5; i++)
      await deleteEmptyFolders(frameworkPath)

    const from = resolve(process.cwd(), './updates/.stacks')
    const to = frameworkPath
    await copyFolder(from, to, exclude)

    consola.info('Cleanup...')
    await deleteFolder(tempUpdatePath)
    consola.success('Framework updated.')
  }

  // then, we need to update the project's & framework's dependencies, if updates available
  if (options.dependencies) {
    consola.info('Updating dependencies...')
    await runNpmScript(NpmScript.Update)
    consola.success('Updated dependencies.')
  }

  // TODO: also update CI files & configurations, and other files, possibly
  // ideally we want this to be smart enough to update only the files that have changed

  // TODO: this script should trigger regeneration of auto-imports.d.ts & components.d.ts
}
