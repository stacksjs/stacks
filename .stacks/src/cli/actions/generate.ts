import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { ExitCode, type GeneratorOptions, NpmScript } from '@stacksjs/types'
import { debugLevel } from '@stacksjs/config'
import { lintFix } from './lint'
import { generateTypes } from './types'

export async function generateLibEntries(options?: GeneratorOptions) {
  try {
    const debug = debugLevel(options)

    await runNpmScript(NpmScript.GenerateEntries, { debug })
    consola.success('Library entry points were generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating your library entry points.')
    consola.error(error)
  }
}

export async function generateVueCompat(options?: GeneratorOptions) {
  try {
    const debug = debugLevel(options)

    await runNpmScript(NpmScript.GenerateVueCompat, { debug })
    consola.success('Vue 2 & 3 compatibility was generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating Vue compatibility.')
    consola.error(error)
  }
}

export async function generateWebTypes(options?: GeneratorOptions) {
  try {
    const debug = debugLevel(options)

    await runNpmScript(NpmScript.GenerateWebTypes, { debug })
    consola.success('Successfully generated the web-types.json file.')
  }
  catch (error) {
    consola.error('There was an error generating the web-types.json file')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function generateVsCodeCustomData(options?: GeneratorOptions) {
  try {
    const debug = debugLevel(options)

    await runNpmScript(NpmScript.GenerateVsCodeCustomData, { debug })
    await lintFix('ignore') // the created json file needs to be linted
    consola.success('Successfully generated the custom-elements.json file.')
  }
  catch (error) {
    consola.error('There was an error generating the custom-elements.json file')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function generateIdeHelpers(options?: GeneratorOptions) {
  try {
    const debug = debugLevel(options)

    await runNpmScript(NpmScript.GenerateIdeHelpers, { debug })
    await lintFix('ignore') // the created json file needs to be linted
    consola.success('Successfully generated IDE helpers.')
  }
  catch (error) {
    consola.error('There was an error generating IDE helpers.')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function generateComponentMeta(options?: GeneratorOptions) {
  try {
    const debug = debugLevel(options)

    await runNpmScript(NpmScript.GenerateComponentMeta, { debug })
    await lintFix('ignore') // the created json file needs to be linted
    consola.success('Successfully generated component meta.')
  }
  catch (error) {
    consola.error('There was an error generating your component meta information.')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function startGenerationProcess(options?: GeneratorOptions) {
  if (options?.types)
    await generateTypes(options)

  else if (options?.entries)
    await generateLibEntries(options)

  else if (options?.webTypes)
    await generateWebTypes(options)

  else if (options?.customData)
    await generateVsCodeCustomData(options)

  else if (options?.ideHelpers)
    await generateIdeHelpers(options)

  else if (options?.vueCompatibility)
    await generateVueCompat(options)

  else if (options?.componentMeta)
    await generateComponentMeta(options)
}
