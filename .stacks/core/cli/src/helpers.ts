import { debugLevel } from '@stacksjs/config'
import type { CliOptions, Spinner } from '@stacksjs/types'
import { projectPath } from '@stacksjs/path'
import { spinner } from '@stacksjs/cli'
import { italic } from './utilities'
import { spawn } from './command'

export async function runCommand(command: string, options?: CliOptions) {
  const debug = debugLevel(options)
  let spin = options?.loadingAnimation

  if (options?.shortLived) {
    if (spin)
      spin = spinner('Running...').start()

    await spawn(command, { stdio: debug, cwd: options?.cwd || projectPath() })
    return spin
  }

  await animatedLoading(options)
  await spawn(command, { stdio: debug, cwd: options?.cwd || projectPath() })

  if (typeof spin === 'object' && spin.isSpinning)
    spin.stop()
}

async function animatedLoading(options?: CliOptions) {
  const debug = debugLevel(options)
  const waitingCopy = 'This may take a little while...'
  let spin = options?.loadingAnimation

  // the spinner is not shown when debug output is being inherited
  if (debug !== 'inherit' && typeof spin === 'object') {
    if (spin.isSpinning && spin.text === 'Running...') {
      setTimeout(() => {
        (spin as Spinner).text = italic(waitingCopy)
      }, 5000)
      return
    }

    spin = spinner('Running...').start()
    setTimeout(() => {
      (spin as Spinner).text = italic(waitingCopy)
    }, 5000)
  }
}

export async function runShortLivedCommand(command: string, options?: CliOptions) {
  return await runCommand(command, { shortLived: true, ...options })
}

export async function runLongRunningCommand(command: string, options?: CliOptions) {
  return await runCommand(command, { shortLived: false, ...options })
}

export { installPackage } from '@antfu/install-pkg'
