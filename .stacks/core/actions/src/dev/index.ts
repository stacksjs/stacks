import { log } from '@stacksjs/logging'
import { runNpmScript } from '@stacksjs/utils'
import type { DevOptions } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/types'

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function dev(options: DevOptions) {
  return invoke(options)
}

export async function components(options: DevOptions) {
  log.info('Starting your components dev server...')
  await runNpmScript(NpmScript.DevComponents, options)
}

export async function desktop(options: DevOptions) {
  log.info('Starting your Desktop engine...')
  await runNpmScript(NpmScript.DevDesktop, options)
}

export async function pages(options: DevOptions) {
  log.info('Starting your page engine...')
  await runNpmScript(NpmScript.DevPages, options)
}

export async function functions(options: DevOptions) {
  log.info('Starting your function\'s dev server...')
  await runNpmScript(NpmScript.DevFunctions, options)
}
