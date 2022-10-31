import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { ExitCode, NpmScript, type PrepublishOptions } from '@stacksjs/types'

export async function invoke(options?: PrepublishOptions) {
  try {
    consola.info('Running prepublish command...')
    await runNpmScript(NpmScript.BuildStacks, options)
    consola.success('prepublish command completed.')
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function prepublish(options: PrepublishOptions) {
  return invoke(options)
}
