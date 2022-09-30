import consola from 'consola'
import * as ezSpawn from '@jsdevtools/ez-spawn'
import { NpmScript, copyFiles, deleteFolder } from '../../../src'
import { runNpmScript } from './run-npm-script'

export async function stacks(options: any) {
  if (options.dependencies)
    await runNpmScript(NpmScript.Update)

  if (options.framework) {
    consola.success('Downloading framework updates...')
    await ezSpawn.async('giget stacks updates', { stdio: 'ignore' }) // TODO: stdio should inherit when APP_DEBUG or debug flag is true
    await copyFiles('./updates/.stacks', './.stacks') // overwrite the core framework files

    // cleanup
    await deleteFolder('./updates')

    consola.success('Updated the Stacks framework.')
  }

  // TODO: how to gracefully handle potential overwrites?
  // Even though they should not happen due to usage of
  // configurations, when they do, how should they be handled?
  // Approach 1: we could check git for updated to the .stacks dir and then ask whether to proceed

  // TODO: also update CI files & other files, possibly
}
