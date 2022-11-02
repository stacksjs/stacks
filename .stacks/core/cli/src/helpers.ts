import { debugLevel } from '@stacksjs/config'
import type { CliOptions } from '@stacksjs/types'
import { projectPath } from '@stacksjs/path'
import { italic } from './utilities'
import { spinner } from './spinner'
import { spawn } from './command'

export async function runCommand(command: string, options?: CliOptions) {
  const debug = debugLevel(options)

  if (options?.shortLived) {
    await spawn.async(command, { stdio: debug, cwd: options?.cwd || projectPath() })
    return
  }

  const spin = spinner('Running...').start()

  setTimeout(() => {
    spin.text = italic('This may take a little while...')
  }, 5000)

  await spawn.async(command, { stdio: debug, cwd: options?.cwd || projectPath() })

  spin.stop()
}

export async function runShortLivedCommand(command: string, options?: CliOptions) {
  return await runCommand(command, { shortLived: true, ...options })
}

export async function runLongRunningCommand(command: string, options?: CliOptions) {
  return await runCommand(command, { shortLived: false, ...options })
}

export { installPackage } from '@antfu/install-pkg'
