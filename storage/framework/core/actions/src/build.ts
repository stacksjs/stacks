import { NpmScript } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { hasComponents, hasFunctions } from '@stacksjs/storage'
import type { BuildOptions } from '@stacksjs/types'
import { runNpmScript } from '@stacksjs/utils'
import { generateTypes } from './generate'

export async function invoke(options: BuildOptions) {
  if (options.components) await componentLibraries(options)
  else if (options.vueComponents) await vueComponentLibrary(options)
  else if (options.webComponents || options.elements)
    await webComponentLibrary(options)
  else if (options.functions) await functionsLibrary(options)
  else if (options.docs) await docs(options)
  else if (options.stacks) await stacks(options)

  await generateTypes()
}

export async function build(options: BuildOptions) {
  return invoke(options)
}

export async function componentLibraries(options: BuildOptions) {
  await runNpmScript(NpmScript.GenerateEntries, options)
  await vueComponentLibrary(options)
  await webComponentLibrary(options)
}

export async function vueComponentLibrary(options: BuildOptions) {
  if (hasComponents()) {
    log.info('Building your component library...')
    await runNpmScript(NpmScript.BuildComponents, options)
    log.success('Your component library was built successfully')
  } else {
    // todo: throw custom error here
    log.warn('No components found.')
    log.info('Before you can build components,')
    log.info('you need to have created some in the ./components folder.')
  }
}

export async function webComponentLibrary(options: BuildOptions) {
  log.info(
    'Building your component library for production use & npm/CDN distribution...',
  )

  if (hasComponents()) {
    await runNpmScript(NpmScript.BuildWebComponents, options)
    log.success('Your Web Component library was built successfully')
  } else {
    // todo: throw custom error here
    log.info('No components found.')
  }
}

export async function docs(options: BuildOptions) {
  log.info('Building the documentation site...')
  await runNpmScript(NpmScript.BuildDocs, options)
  log.success('Docs built successfully')
}

export async function stacks(options: BuildOptions) {
  log.info('Building the Stacks Framework...')
  await runNpmScript(NpmScript.BuildStacks, options)
  log.success('Stacks built successfully')
}

export async function functionsLibrary(options: BuildOptions) {
  if (hasFunctions()) {
    log.info('Building your functions library for production usages...')
    log.info(
      'Production usages include: manual npm distribution and/or CDN distribution',
    )
    await runNpmScript(NpmScript.BuildFunctions, options)
    log.success('Functions library built successfully')
  } else {
    log.info('No functions found')
  }
}
