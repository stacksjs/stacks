import { consola } from '@stacksjs/cli'
import { hasComponents, hasFunctions } from '@stacksjs/storage'
import { runNpmScript } from '@stacksjs/utils'
import { type BuildOptions, NpmScript } from '@stacksjs/types'
import { generateTypes } from './types'

export async function buildComponentLibraries() {
  try {
    await runNpmScript(NpmScript.GenerateEntries)
    await buildVueComponentLibrary()
    await buildWebComponentLibrary()
  }
  catch (error) {
    consola.error('There was an error building your component libraries.')
    consola.error(error)
  }
}

export async function buildVueComponentLibrary() {
  consola.info('Building your component library...')

  if (hasComponents()) {
    try {
      await runNpmScript(NpmScript.BuildComponents)
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

export async function buildWebComponentLibrary() {
  consola.info('Building your component library for production use & npm/CDN distribution...')

  if (hasComponents()) {
    try {
      await runNpmScript(NpmScript.BuildWebComponents)
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

export async function buildDocs() {
  consola.info('Building the Artisan CLI...')

  try {
    await runNpmScript(NpmScript.BuildDocs)
    consola.success('Artisan CLI was built successfully.')
  }
  catch (error) {
    consola.error('There was an error building the Artisan CLI.')
    consola.error(error)
  }
}

export async function buildStacks() {
  consola.info('Building the Stacks Framework...')

  try {
    await runNpmScript(NpmScript.BuildStacks)
    consola.success('Stacks was built successfully.')
  }
  catch (error) {
    consola.error('There was an error building the Stacks framework.')
    consola.error(error)
  }
}

export async function buildFunctionsLibrary() {
  consola.info('Building your functions library for production use & npm/CDN distribution...')

  if (hasFunctions()) {
    try {
      await runNpmScript(NpmScript.BuildFunctions)
      consola.success('Your functions library was built successfully.')
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

export async function startBuildProcess(options: BuildOptions) {
  if (options.components)
    await buildComponentLibraries()

  else if (options.vueComponents)
    await buildVueComponentLibrary()

  else if (options.webComponents || options.elements)
    await buildWebComponentLibrary()

  else if (options.functions)
    await buildFunctionsLibrary()

  else if (options.docs)
    await buildDocs()

  else if (options.stacks)
    await buildStacks()

  await generateTypes()
}
