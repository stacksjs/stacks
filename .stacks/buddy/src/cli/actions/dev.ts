import { log } from '@stacksjs/x-ray'
import { runNpmScript } from '@stacksjs/utils'
import type { DevOptions } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/types'

export async function invoke(options: DevOptions) {
  if (options.components || options.all)
    await components(options)

  else if (options.docs || options.all)
    await docs(options)

  else if (options.pages || options.all)
    await pages(options)

  else if (options.functions || options.all)
    await functions(options)

  else if (options.desktop || options.all)
    await desktop(options)
}

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

export async function docs(options: DevOptions) {
  log.info('Starting your docs dev server...')
  await runNpmScript(NpmScript.DevDocs, options)
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
