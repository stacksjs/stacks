import { log } from '@stacksjs/logging'
import { frameworkPath } from '@stacksjs/path'
import { runCommand } from '@stacksjs/cli'
import { type DevOptions } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/types'

export async function runComponentsDevServer(options: DevOptions) {
  log.info('Starting your components dev server...')
  await runCommand(NpmScript.DevComponents, { ...options, cwd: frameworkPath() })
}

export async function runDesktopDevServer(options: DevOptions) {
  log.info('Starting your Desktop engine...')
  await runCommand(NpmScript.DevDesktop, options)
}

export async function runPagesDevServer(options: DevOptions) {
  log.info('Starting your page engine...')
  await runCommand(NpmScript.DevPages, options)
}

export async function runFunctionsDevServer(options: DevOptions) {
  log.info('Starting your function\'s dev server...')
  await runCommand(NpmScript.DevFunctions, options)
}
