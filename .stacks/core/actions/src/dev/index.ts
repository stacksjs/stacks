import { log } from '@stacksjs/logging'
import { frameworkPath } from '@stacksjs/path'
import { runCommand } from '@stacksjs/cli'
import { type DevOptions } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/types'

export async function components(options: DevOptions) {
  log.info('Starting your components dev server...')
  await runCommand(NpmScript.DevComponents, { ...options, cwd: frameworkPath() })
}

export async function desktop(options: DevOptions) {
  log.info('Starting your Desktop engine...')
  await runCommand(NpmScript.DevDesktop, options)
}

export async function pages(options: DevOptions) {
  log.info('Starting your page engine...')
  await runCommand(NpmScript.DevPages, options)
}

export async function functions(options: DevOptions) {
  log.info('Starting your function\'s dev server...')
  await runCommand(NpmScript.DevFunctions, options)
}
