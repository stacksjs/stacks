import type { BuildOptions } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { hasFunctions } from '@stacksjs/storage'
import { runNpmScript } from '@stacksjs/utils'
import { buildStxComponentLibrary } from './build/component-library'
import { generateTypes } from './generate'
import { generateProjectImages } from './generate/images'

export async function invoke(options: BuildOptions): Promise<void> {
  if (options.components)
    await componentLibraries(options)
  else if (options.webComponents || options.elements)
    await webComponentLibrary()
  else if (options.functions)
    await functionsLibrary(options)
  else if (options.docs)
    await docs(options)
  else if (options.stacks)
    await stacks(options)

  await generateTypes()

  // Social cards quote the site's own copy, so a build that changes the copy
  // and leaves the card behind ships a preview that contradicts the page.
  // Rebuilding here keeps them honest; it no-ops unless the project declares
  // cards in `config/images.ts`. App Store screenshots are excluded on purpose
  // — they are built from captures of a finished build, so they belong to the
  // publish step rather than this one.
  try {
    await generateProjectImages({ only: ['social', 'app-icons'] })
  }
  catch (error) {
    // A missing font or capture should not take a build down: the images are
    // an output of the build, not an input to it.
    log.warn(`[build] image generation skipped: ${(error as Error).message}`)
  }
}

export async function build(options: BuildOptions): Promise<void> {
  return await invoke(options)
}

export async function componentLibraries(options: BuildOptions): Promise<void> {
  await runNpmScript(NpmScript.GenerateEntries, options)
  await stxComponentLibrary()
}

export async function stxComponentLibrary(): Promise<void> {
  await buildStxComponentLibrary()
}

export async function webComponentLibrary(): Promise<void> {
  await buildStxComponentLibrary()
}

export async function docs(options: BuildOptions): Promise<void> {
  log.info('Building the documentation site...')
  await runNpmScript(NpmScript.BuildDocs, options)
  log.success('Docs built successfully')
}

export async function stacks(options: BuildOptions): Promise<void> {
  log.info('Building the Stacks Framework...')
  await runNpmScript(NpmScript.BuildStacks, options)
  log.success('Stacks built successfully')
}

export async function functionsLibrary(options: BuildOptions): Promise<void> {
  if (hasFunctions()) {
    log.info('Building your functions library for production usages...')
    log.info('Production usages include: manual npm distribution and/or CDN distribution')
    await runNpmScript(NpmScript.BuildFunctions, options)
    log.success('Functions library built successfully')
  }
  else {
    log.info('No functions found')
  }
}
