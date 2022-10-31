import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import type { DevOptions } from '@stacksjs/types'
import { ExitCode, NpmScript } from '@stacksjs/types'

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

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function dev(options: DevOptions) {
  return invoke(options)
}

export async function components(options: DevOptions) {
  try {
    consola.info('Starting your components dev server...')
    await runNpmScript(NpmScript.DevComponents, options)
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function docs(options: DevOptions) {
  try {
    consola.info('Starting your docs dev server...')
    await runNpmScript(NpmScript.DevDocs, options)
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function pages(options: DevOptions) {
  try {
    consola.info('Starting your page engine...')
    await runNpmScript(NpmScript.DevPages, options)
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function functions(options: DevOptions) {
  try {
    consola.info('Starting your function\'s dev server...')
    await runNpmScript(NpmScript.DevFunctions, options)
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}
