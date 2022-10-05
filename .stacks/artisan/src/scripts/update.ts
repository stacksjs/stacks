import * as ezSpawn from '@jsdevtools/ez-spawn'
import consola from 'consola'
import Prompts from 'prompts'
import { ExitCode } from '../cli/exit-code'
import { NpmScript, copyFiles, deleteFolder } from '../helpers'
import { runNpmScript } from './run-npm-script'

const { prompts } = Prompts

export async function stacks(options: any) {
  if (options.dependencies) {
    consola.info('Updating dependencies...')
    await runNpmScript(NpmScript.Update)
    consola.success('Updated dependencies.')
  }

  if (options.framework) {
    try {
      // check if the .stacks folder has any updates
      // https://carlosbecker.com/posts/git-changed/
      await ezSpawn.async('git diff --quiet HEAD -- ./.stacks', { stdio: 'inherit', cwd: process.cwd() })
    }
    catch (error: any) {
      if (error.status === 1) {
        // even though the ./.stacks folder should not be edited, instead config values should be adjusted,
        // there is a chance that users may apply local core edits, as it's totally acceptable,
        // as long as the user knows what they are doing.
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
    await ezSpawn.async('giget stacks updates', { stdio: 'ignore' }) // TODO: stdio should inherit when APP_DEBUG or debug flag is true
    await copyFiles('./updates/.stacks', './.stacks') // overwrite the core framework files

    // cleanup
    await deleteFolder('./updates')
    consola.success('Updated the Stacks framework.')
  }

  // TODO: also update CI files & configurations, and other files, possibly
}
