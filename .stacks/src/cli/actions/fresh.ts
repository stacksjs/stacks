import { consola, spawn } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { type CliOptions, ExitCode } from '@stacksjs/types'
import { debugLevel } from '@stacksjs/config'
import { italic } from 'kolorist'

export async function invoke(options?: CliOptions) {
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
