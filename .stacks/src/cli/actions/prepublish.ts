import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { type CliOptions, ExitCode, NpmScript } from '@stacksjs/types'
import { app } from '@stacksjs/config'

export async function runPrepublish(options?: CliOptions) {
  try {
    let debug: 'inherit' | 'ignore' = app.debug ? 'inherit' : 'ignore'

    if (options?.debug)
      debug = options.debug ? 'inherit' : 'ignore'

    consola.info('Running prepublish script...')
    await runNpmScript(NpmScript.BuildStacks, { debug })
    consola.success('prepublish script completed.')
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}
