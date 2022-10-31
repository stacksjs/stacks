import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { ExitCode, NpmScript, type TypesOptions } from '@stacksjs/types'

export async function invoke(options?: TypesOptions) {
  try {
    await runNpmScript(NpmScript.TypesFix, options)
    consola.success('Types were fixed.')
  }
  catch (error) {
    consola.error('There was an error fixing your types.')
    consola.error(error)
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
