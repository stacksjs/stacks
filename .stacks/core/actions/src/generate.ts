import { log } from '@stacksjs/logging'
import { NpmScript } from '@stacksjs/types'
import type { GeneratorOptions } from '@stacksjs/types'
import { runNpmScript } from '@stacksjs/utils'
import { projectPath } from '@stacksjs/path'
import { runCommand } from '@stacksjs/cli'
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
  const result = await runCommand('esno .stacks/core/actions/src/generate-package-json.ts', { ...options, debug: true, cwd: projectPath() })

  if (result.isErr()) {
    log.error('There was an error generating your library entry points.', result.error)
    process.exit()
  }

  log.success('Library entry points were generated successfully')
}

export async function vueCompat(options?: GeneratorOptions) {
  const result = await runNpmScript(NpmScript.GenerateVueCompat, options)

  if (result.isErr()) {
    log.error('There was an error generating Vue 2 compatibility.', result.error)
    process.exit()
  }

  log.success('Libraries are now Vue 2 & 3 compatible')
}

export async function webTypes(options?: GeneratorOptions) {
  const result = await runNpmScript(NpmScript.GenerateWebTypes, options)

  if (result.isErr()) {
    log.error('There was an error generating the web-types.json file.', result.error)
    process.exit()
  }

  log.success('Successfully generated the web-types.json file')
}

export async function vsCodeCustomData(options?: GeneratorOptions) {
  const result = await runNpmScript(NpmScript.GenerateVsCodeCustomData, options)

  if (result.isErr()) {
    log.error('There was an error generating the custom-elements.json file.', result.error)
    process.exit()
  }

  await lintFix({ fix: true }) // the created json file needs to be linted
  log.success('Successfully generated the custom-elements.json file')
}

export async function ideHelpers(options?: GeneratorOptions) {
  const result = await runNpmScript(NpmScript.GenerateIdeHelpers, options)

  if (result.isErr()) {
    log.error('There was an error generating IDE helpers.', result.error)
    process.exit()
  }

  await lintFix({ fix: true }) // the created json file needs to be linted
  log.success('Successfully generated IDE helpers')
}

export async function componentMeta(options?: GeneratorOptions) {
  const result = await runNpmScript(NpmScript.GenerateComponentMeta, options)

  if (result.isErr()) {
    log.error('There was an error generating your component meta information.', result.error)
    process.exit()
  }

  await lintFix({ fix: true }) // the created json file needs to be linted
  log.success('Successfully generated component meta information')
}

export async function types(options?: GeneratorOptions) {
  const result = await runNpmScript(NpmScript.GenerateTypes, options)

  if (result.isErr()) {
    log.error('There was an error generating your types.', result.error)
    process.exit()
  }

  log.success('Types were generated successfully')
}
