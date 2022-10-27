import { consola, spawn } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { type CliOptions, ExitCode, type IOType } from '@stacksjs/types'
import { app } from '@stacksjs/config'

export async function runClean(options?: CliOptions) {
  try {
    let debug: IOType = app.debug ? 'inherit' : 'ignore'

    if (options?.debug)
      debug = options.debug ? 'inherit' : 'ignore'

    consola.info('Running clean command...')
    await spawn.async('rimraf ./pnpm-lock.yaml ./node_modules/ ./**/node_modules', { stdio: debug, cwd: projectPath() })
    consola.success('clean completed')
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}
