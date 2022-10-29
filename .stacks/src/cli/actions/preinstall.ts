import { consola, spawn } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { type CliOptions, ExitCode } from '@stacksjs/types'
import { debugLevel } from '@stacksjs/config'

export async function invoke(options?: CliOptions) {
  try {
    const debug = debugLevel(options)

    consola.info('Preinstall check...')
    await spawn.async('npx only-allow pnpm', { stdio: debug, cwd: projectPath() })
    consola.success('Environment ready.')
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}
