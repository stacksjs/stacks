import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { type CliOptions, ExitCode, NpmScript } from '@stacksjs/types'

export async function invoke(options?: CliOptions) {
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
