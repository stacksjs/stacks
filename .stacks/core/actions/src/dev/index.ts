import { log } from '@stacksjs/logging'
import { runCommand } from '@stacksjs/cli'
import type { DevOptions } from '@stacksjs/types'
import { Action, NpmScript } from '@stacksjs/types'

export async function runComponentsDevServer(options: DevOptions) {
  log.info('Starting your components dev server...')
  await runAction(Action.DevComponents, options)
}

export async function runDesktopDevServer(options: DevOptions) {
  log.info('Starting your Desktop engine...')
  await runCommand(NpmScript.DevDesktop, options)
}

export async function runPagesDevServer(options: DevOptions) {
  log.info('Starting your page engine...')
  await runCommand(NpmScript.DevViews, options)
}

export async function runFunctionsDevServer(options: DevOptions) {
  log.info('Starting your function\'s dev server...')
  await runCommand(NpmScript.DevFunctions, options)
}
