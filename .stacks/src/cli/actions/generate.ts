import { consola } from '@stacksjs/cli'
import { ExitCode, NpmScript } from '@stacksjs/types'
import type { GeneratorOptions } from '@stacksjs/types'
import { runNpmScript } from '@stacksjs/utils'
import { lintFix } from './lint'

export async function invoke(options?: GeneratorOptions) {
  if (options?.types)
    await types(options)

  else if (options?.entries)
    await libEntries(options)

  else if (options?.webTypes)
    await webTypes(options)

  else if (options?.customData)
    await vsCodeCustomData(options)

  else if (options?.ideHelpers)
    await ideHelpers(options)

  else if (options?.vueCompatibility)
    await vueCompat(options)

  else if (options?.componentMeta)
    await componentMeta(options)
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function generate(options: GeneratorOptions) {
  return invoke(options)
}

export async function libEntries(options: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.GenerateEntries, options)
    consola.success('Library entry points were d successfully.')
  }
  catch (error) {
    consola.error('There was an error generating your library entry points.')
    consola.error(error)
  }
}

export async function vueCompat(options?: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.GenerateVueCompat, options)
    consola.success('Libraries are now Vue 2 & 3 compatible.')
  }
  catch (error) {
    consola.error('There was an error generating Vue compatibility.')
    consola.error(error)
  }
}

export async function webTypes(options?: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.GenerateWebTypes, options)
    consola.success('Successfully d the web-types.json file.')
  }
  catch (error) {
    consola.error('There was an error generating the web-types.json file')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function vsCodeCustomData(options?: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.GenerateVsCodeCustomData, options)
    await lintFix(options) // the created json file needs to be linted
    consola.success('Successfully d the custom-elements.json file.')
  }
  catch (error) {
    consola.error('There was an error generating the custom-elements.json file')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function ideHelpers(options?: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.GenerateIdeHelpers, options)
    await lintFix(options) // the created json file needs to be linted
    consola.success('Successfully d IDE helpers.')
  }
  catch (error) {
    consola.error('There was an error generating IDE helpers.')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function componentMeta(options?: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.GenerateComponentMeta, options)
    await lintFix(options) // the created json file needs to be linted
    consola.success('Successfully d component meta.')
  }
  catch (error) {
    consola.error('There was an error generating your component meta information.')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function types(options?: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.GenerateTypes, options)
    consola.success('Types were generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating your types.')
    consola.error(error)
  }
}
