import { consola, spawn } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { type CliOptions, ExitCode, type IOType } from '@stacksjs/types'
import { app } from '@stacksjs/config'

export async function runPreinstall(options?: CliOptions) {
  try {
    let debug: IOType = app.debug ? 'inherit' : 'ignore'

    if (options?.debug)
      debug = options.debug ? 'inherit' : 'ignore'

    consola.info('Running preinstall command...')
    await spawn.async('npx only-allow pnpm', { stdio: debug, cwd: projectPath() })
    consola.success('preinstall command completed.')
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}
