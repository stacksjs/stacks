import { consola, spawn } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { type CliOptions, ExitCode, type IOType } from '@stacksjs/types'
import { app } from '@stacksjs/config'

export async function runFresh(options?: CliOptions) {
  try {
    let debug: IOType = app.debug ? 'inherit' : 'ignore'

    if (options?.debug)
      debug = options.debug ? 'inherit' : 'ignore'

    consola.info('Running fresh command...')
    await spawn.async('pnpm run clean', { stdio: debug, cwd: projectPath() })
    await spawn.async('pnpm install', { stdio: debug, cwd: projectPath() })
    consola.success('fresh completed')
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}
