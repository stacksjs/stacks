import * as ezSpawn from '@jsdevtools/ez-spawn'
import consola from 'consola'
import Prompts from 'prompts'
import { resolve } from 'pathe'
import { ExitCode } from '../cli/exit-code'
import { copyFolder, deleteFolder } from '../../../core/utils/fs'
import { NpmScript } from '../../../core/types/cli'
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
    await ezSpawn.async('giget stacks updates', { stdio: options.debug ? 'inherit' : 'ignore' }) // TODO: stdio should inherit when APP_DEBUG or debug flag is true
    consola.success('Downloaded framework updates.')

    consola.info('Updating framework...')
    const from = resolve('./updates/.stacks', process.cwd())
    const to = resolve('.stacks', process.cwd())
    const pathsToExclude = ['node_modules', 'functions/package.json', 'components/package.json', 'web-components/package.json', 'auto-imports.d.ts', 'components.d.ts', 'dist']
    await copyFolder(from, to, pathsToExclude) // overwrite the core framework files

    consola.info('Cleanup...')
    await deleteFolder('./updates')
    consola.success('Framework updated.')
  }

  // TODO: also update CI files & configurations, and other files, possibly
  // ideally we want this to be smart enough to update only the files that have changed

  // TODO: this script should trigger regeneration of auto-imports.d.ts & components.d.ts
}
