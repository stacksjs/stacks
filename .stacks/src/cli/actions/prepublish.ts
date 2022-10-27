import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { type CliOptions, ExitCode, NpmScript } from '@stacksjs/types'
import { app } from '@stacksjs/config'

export async function runPrepublish(options?: CliOptions) {
  try {
    const debug = options?.debug ? options.debug : app.debug

    consola.info('Running prepublish command...')
    await runNpmScript(NpmScript.BuildStacks, { debug })
    consola.success('prepublish command completed.')
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}
