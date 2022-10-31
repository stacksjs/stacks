import { consola, italic, spawn } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { ExitCode, type CliOptions as FreshOptions } from '@stacksjs/types'
import { debugLevel } from '@stacksjs/config'

export async function invoke(options?: FreshOptions) {
  try {
    const debug = debugLevel(options)

    consola.info(`Running the fresh command. ${italic('This may take a while...')}`)
    await spawn.async('pnpm run clean', { stdio: debug, cwd: projectPath() })
    await spawn.async('pnpm install', { stdio: debug, cwd: projectPath() })
    consola.success('Freshly reinstalled your dependencies.')
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function fresh(options: FreshOptions) {
  return invoke(options)
}
