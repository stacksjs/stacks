import { log } from '@stacksjs/x-ray'
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
  await runNpmScript(NpmScript.GenerateEntries, options)
  log.success('Library entry points were generated successfully.')
}

export async function vueCompat(options?: GeneratorOptions) {
  await runNpmScript(NpmScript.GenerateVueCompat, options)
  log.success('Libraries are now Vue 2 & 3 compatible.')
}

export async function webTypes(options?: GeneratorOptions) {
  await runNpmScript(NpmScript.GenerateWebTypes, options)
  log.success('Successfully generated the web-types.json file.')
}

export async function vsCodeCustomData(options?: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.GenerateVsCodeCustomData, options)
    await lintFix({ fix: true }) // the created json file needs to be linted
    log.success('Successfully generated the custom-elements.json file.')
  }
  catch (error) {
    log.error('There was an error generating the custom-elements.json file')
    log.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function ideHelpers(options?: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.GenerateIdeHelpers, options)
    await lintFix({ fix: true }) // the created json file needs to be linted
    log.success('Successfully generated IDE helpers.')
  }
  catch (error) {
    log.error('There was an error generating IDE helpers.')
    log.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function componentMeta(options?: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.GenerateComponentMeta, options)
    await lintFix({ fix: true }) // the created json file needs to be linted
    log.success('Successfully d component meta.')
  }
  catch (error) {
    log.error('There was an error generating your component meta information.')
    log.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function types(options?: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.GenerateTypes, options)
    log.success('Types were generated successfully.')
  }
  catch (error) {
    log.error('There was an error generating your types.')
    log.error(error)
    process.exit(ExitCode.FatalError)
  }
}
