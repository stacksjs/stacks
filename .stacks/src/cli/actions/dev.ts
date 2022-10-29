import { consola } from '@stacksjs/cli'
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
}

export async function dev(options: DevOptions) {
  return invoke(options)
}

export async function components(options: DevOptions) {
  consola.info('Starting your components dev server...')
  await runNpmScript(NpmScript.DevComponents, options)
}

export async function docs(options: DevOptions) {
  consola.info('Starting your docs dev server...')
  await runNpmScript(NpmScript.DevDocs, options)
}

export async function pages(options: DevOptions) {
  consola.info('Starting your page engine...')
  await runNpmScript(NpmScript.DevPages, options)
}

export async function functions(options: DevOptions) {
  consola.info('Starting your function\'s dev server...')
  await runNpmScript(NpmScript.DevFunctions, options)
}
