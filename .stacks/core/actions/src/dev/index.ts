import { log } from '@stacksjs/logging'
import { frameworkPath } from '@stacksjs/path'
import { runCommand } from '@stacksjs/cli'
import { type DevOptions } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/types'

export function runComponentsDevServer(options: DevOptions) {
  log.info('Starting your components dev server...')
  runCommand(NpmScript.DevComponents, { ...options, cwd: frameworkPath() })
}

export function runDesktopDevServer(options: DevOptions) {
  log.info('Starting your Desktop engine...')
  runCommand(NpmScript.DevDesktop, options)
}

export function runPagesDevServer(options: DevOptions) {
  log.info('Starting your page engine...')
  runCommand(NpmScript.DevPages, options)
}

export function runFunctionsDevServer(options: DevOptions) {
  log.info('Starting your function\'s dev server...')
  runCommand(NpmScript.DevFunctions, options)
}
