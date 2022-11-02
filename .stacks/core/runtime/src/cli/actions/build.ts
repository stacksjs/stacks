import { consola } from '@stacksjs/cli'
import { hasComponents, hasFunctions } from '@stacksjs/storage'
import { runNpmScript } from '@stacksjs/utils'
import { type BuildOptions, NpmScript } from '@stacksjs/types'
import { types as generateTypes } from './generate'

export async function invoke(options: BuildOptions) {
  if (options.components)
    await componentLibraries(options)

  else if (options.vueComponents)
    await vueComponentLibrary(options)

  else if (options.webComponents || options.elements)
    await webComponentLibrary(options)

  else if (options.functions)
    await functionsLibrary(options)

  else if (options.docs)
    await docs(options)

  else if (options.stacks)
    await stacks(options)

  await generateTypes()
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
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
    consola.info('Building your component library...')
    await runNpmScript(NpmScript.BuildComponents, options)
    consola.success('Your component library was built successfully.')
  }
  else {
    // todo: throw custom error here
    consola.warn('No components found.')
    consola.info('Before you can build components,')
    consola.info('you need to have developed some in the ./components folder.')
  }
}

export async function webComponentLibrary(options: BuildOptions) {
  consola.info('Building your component library for production use & npm/CDN distribution...')

  if (hasComponents()) {
    await runNpmScript(NpmScript.BuildWebComponents, options)
    consola.success('Your Web Component library was built successfully.')
  }
  else {
    // todo: throw custom error here
    consola.info('No components found.')
  }
}

export async function docs(options: BuildOptions) {
  consola.info('Building the documentation site...')
  await runNpmScript(NpmScript.BuildDocs, options)
  consola.success('Docs built successfully.')
}

export async function stacks(options: BuildOptions) {
  consola.info('Building the Stacks Framework...')
  await runNpmScript(NpmScript.BuildStacks, options)
  consola.success('Stacks built successfully.')
}

export async function functionsLibrary(options: BuildOptions) {
  if (hasFunctions()) {
    consola.info('Building your functions library for production usages...')
    consola.info('Production usages include: manual npm distribution and/or CDN distribution')
    await runNpmScript(NpmScript.BuildFunctions, options)
    consola.success('Functions library built successfully.')
  }
  else {
    consola.info('No functions found.')
  }
}
