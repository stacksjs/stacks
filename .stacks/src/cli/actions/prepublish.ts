import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { type CliOptions, ExitCode, NpmScript } from '@stacksjs/types'
import { app } from '@stacksjs/config'

export async function runPrepublish(options?: CliOptions) {
  try {
    consola.info('Running prepublish script...')

    let debug = app.debug ? 'inherit' : 'ignore'

    if (options?.debug)
      debug = options.debug ? 'inherit' : 'ignore'

    await runNpmScript(NpmScript.BuildStacks, { debug })

    consola.success('prepublish script completed.')
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}
