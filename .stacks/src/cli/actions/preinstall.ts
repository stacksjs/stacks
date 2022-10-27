import { consola, spawn } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { type CliOptions, ExitCode } from '@stacksjs/types'
import { app } from '@stacksjs/config'

export async function runPreinstall(options?: CliOptions) {
  try {
    let debug: 'inherit' | 'ignore' = app.debug ? 'inherit' : 'ignore'

    if (options?.debug)
      debug = options.debug ? 'inherit' : 'ignore'

    consola.info('Running preinstall script...')
    await spawn.async('npx only-allow pnpm', { stdio: debug, cwd: projectPath() })
    consola.success('preinstall script completed.')
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}
