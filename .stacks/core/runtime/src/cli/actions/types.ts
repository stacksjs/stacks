import { log } from '@stacksjs/logging'
import { runNpmScript } from '@stacksjs/utils'
import { ExitCode, NpmScript, type TypesOptions } from '@stacksjs/types'

export async function invoke(options?: TypesOptions) {
  try {
    await runNpmScript(NpmScript.TypesFix, options)
    log.success('Types were fixed.')
  }
  catch (error) {
    log.error('There was an error fixing your types.')
    log.error(error)
    process.exit(ExitCode.FatalError)
  }
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function types(options: TypesOptions) {
  return invoke(options)
}
