import { debugLevel } from '@stacksjs/config'
import type { CliOptions, Spinner } from '@stacksjs/types'
import { projectPath } from '@stacksjs/path'
import { italic } from './utilities'
import { spinner } from './spinner'
import { spawn } from './command'

export async function runCommand(command: string, options?: CliOptions) {
  const debug = debugLevel(options)

  if (options?.shortLived) {
    await spawn(command, { stdio: debug, cwd: options?.cwd || projectPath() })
    return
  }

  let spin: Spinner | undefined

  // the spinner is not shown when the debug when output is being inherited
  if (debug !== 'inherit') {
    spin = spinner('Running...').start()
    setTimeout(() => {
      (spin as Spinner).text = italic('This may take a little while...')
    }, 5000)
  }

  await spawn(command, { stdio: debug, cwd: options?.cwd || projectPath() })

  if (debug !== 'inherit' && spin)
    spin.stop()
}

export async function runShortLivedCommand(command: string, options?: CliOptions) {
  return await runCommand(command, { shortLived: true, ...options })
}

export async function runLongRunningCommand(command: string, options?: CliOptions) {
  return await runCommand(command, { shortLived: false, ...options })
}

export { installPackage } from '@antfu/install-pkg'
