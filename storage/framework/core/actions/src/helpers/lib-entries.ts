import type { LibraryType } from '@stacksjs/path'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { componentsPath, functionsPath, libraryEntryPath } from '@stacksjs/path'
import { writeTextFile } from '@stacksjs/storage'
import { kebabCase } from '@stacksjs/strings'
import { ExitCode } from '@stacksjs/types'
import { determineResetPreset } from '@stacksjs/utils'
import library from '~/config/library'

/**
 * Based on the config values, this method
 * will generate the library entry points.
 *
 * @param type LibraryType
 */
export async function generateLibEntry(type: LibraryType): Promise<void> {
  await createLibraryEntryPoint(type)
}

export async function createLibraryEntryPoint(type: LibraryType): Promise<void> {
  if (type === 'vue-components')
    await createVueLibraryEntryPoint()

  if (type === 'web-components')
    await createWebComponentLibraryEntryPoint()

  if (type === 'functions')
    await createFunctionLibraryEntryPoint()
}

export async function createVueLibraryEntryPoint(type: LibraryType = 'vue-components'): Promise<void> {
  log.info('Ensuring Component Library Entry Point...')

  await writeTextFile({
    path: libraryEntryPath(type),
    data: generateEntryPointData(type),
  }).catch((err: Error) => {
    log.error('There was an error generating the Vue Component Library Entry Point.', err)
    process.exit(ExitCode.FatalError)
  })

  log.success('Created Vue Component Library Entry Point')
}

export async function createWebComponentLibraryEntryPoint(type: LibraryType = 'web-components'): Promise<void> {
  log.info('Ensuring Web Component Library Entry Point...')

  await writeTextFile({
    path: libraryEntryPath(type),
    data: generateEntryPointData(type),
  }).catch((err: Error) => {
    log.error('There was an error generating the Web Component library entry point', err)
    process.exit(ExitCode.FatalError)
  })

  log.success('Created Web Component Library Entry Point')
}

export async function createFunctionLibraryEntryPoint(type: LibraryType = 'functions'): Promise<void> {
  log.info('Ensuring Function Library Entry Point...')

  await writeTextFile({
    path: libraryEntryPath(type),
    data: generateEntryPointData(type),
  }).catch((err: Error) => {
    log.error('There was an error generating Function Library Entry Point', err)
    process.exit(ExitCode.FatalError)
  })

  log.success('Created Functions Library Entry Point')
}

export function generateEntryPointData(type: LibraryType): string {
  let arr = []

  if (type === 'functions') {
    if (!library.functions?.files) {
      log.error(
        new Error(
          'There are no functions defined to be built. Please check your config/library.ts file for potential adjustments',
        ),
      )
      process.exit()
    }

    for (const fx of library.functions.files) {
      if (Array.isArray(fx))
        arr.push(`export * as ${fx[1]} from '${functionsPath(fx[0])}'`)
      else arr.push(`export * from '${functionsPath(fx)}'`)
    }

    // join the array into a string with each element being on a new line
    return arr.join('\r\n')
  }

  if (type === 'vue-components') {
    if (!library.vueComponents?.tags) {
      log.error(
        new Error(
          'There are no components defined to be built. Please check your config/library.ts file for potential adjustments',
        ),
      )
      process.exit()
    }

    arr = determineResetPreset()

    for (const component of library.vueComponents.tags.map(tag => tag.name)) {
      if (Array.isArray(component))
        arr.push(`export { default as ${component[1]} } from '${componentsPath(component[0])}.vue'`)
      else arr.push(`export { default as ${component} } from '${componentsPath(component)}.vue'`)
    }

    // join the array into a string with each element being on a new line
    return arr.join('\r\n')
  }

  // at this point, we know it is a Web Component we are building
  arr = determineResetPreset()
  const imports = [...arr, 'import { defineCustomElement } from \'vue\'']
  const declarations = []
  const definitions = []

  if (!library.webComponents?.tags) {
    log.error(
      new Error(
        'There are no components defined to be built. Please check your config/library.ts file for potential adjustments',
      ),
    )
    process.exit()
  }

  for (const component of library.webComponents.tags.map(tag => tag.name)) {
    if (Array.isArray(component)) {
      imports.push(`import ${component[1]} from '${componentsPath(component[0])}.vue'`)
      declarations.push(`const ${component[1]}CustomElement = defineCustomElement(${component[1]})`)
      definitions.push(`customElements.define('${kebabCase(component[1] as string)}', ${component[1]}CustomElement)`)
    }
    else {
      imports.push(`import ${component} from '${componentsPath(component)}.vue'`)
      declarations.push(`const ${component}CustomElement = defineCustomElement(${component})`)
      definitions.push(`customElements.define('${kebabCase(component)}', ${component}CustomElement)`)
    }
  }

  // join the array into a string with each element being on a new line
  return [...imports, ...declarations, ...definitions].join('\r\n')
}
