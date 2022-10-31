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
  try {
    await runNpmScript(NpmScript.GenerateEntries, options)
    await vueComponentLibrary(options)
    await webComponentLibrary(options)
  }
  catch (error) {
    consola.error('There was an error building your component libraries.')
    consola.error(error)
  }
}

export async function vueComponentLibrary(options: BuildOptions) {
  consola.info('Building your component library...')

  if (hasComponents()) {
    try {
      await runNpmScript(NpmScript.BuildComponents, options)
      consola.success('Your component library was built successfully.')
    }
    catch (error) {
      consola.error('There was an error building your component library.')
      consola.error(error)
    }
  }
  else {
    consola.info('No components found.')
  }
}

export async function webComponentLibrary(options: BuildOptions) {
  consola.info('Building your component library for production use & npm/CDN distribution...')

  if (hasComponents()) {
    try {
      await runNpmScript(NpmScript.BuildWebComponents, options)
      consola.success('Your Web Component library was built successfully.')
    }
    catch (error) {
      consola.error('There was an error building your Web Component library.')
      consola.error(error)
    }
  }
  else {
    consola.info('No components found.')
  }
}

export async function docs(options: BuildOptions) {
  consola.info('Building the documentation site...')

  try {
    await runNpmScript(NpmScript.BuildDocs, options)
    consola.success('Docs built successfully.')
  }
  catch (error) {
    consola.error('There was an error building the documentation.')
    consola.error(error)
  }
}

export async function stacks(options: BuildOptions) {
  consola.info('Building the Stacks Framework...')

  try {
    await runNpmScript(NpmScript.BuildStacks, options)
    consola.success('Stacks built successfully.')
  }
  catch (error) {
    consola.error('There was an error building the Stacks framework.')
    consola.error(error)
  }
}

export async function functionsLibrary(options: BuildOptions) {
  consola.info('Building your functions library for production usages...')
  consola.info('Production usages include: manual npm distribution and/or CDN distribution')

  if (hasFunctions()) {
    try {
      await runNpmScript(NpmScript.BuildFunctions, options)
      consola.success('Functions library built successfully.')
    }
    catch (error) {
      consola.error('There was an error building your functions library.')
      consola.error(error)
    }
  }
  else {
    consola.info('No functions found.')
  }
}
