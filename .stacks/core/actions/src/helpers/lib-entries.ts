import { log } from '@stacksjs/logging'

// import { kebabCase } from '@stacksjs/strings'
import { libraryEntryPath } from '@stacksjs/path'
import { writeTextFile } from '@stacksjs/storage'
import { determineResetPreset } from '@stacksjs/utils'
import type { LibEntryType } from '@stacksjs/types'
import { library } from '@stacksjs/config'

/**
 * Based on the config values, this method
 * will generate the library entry points.
 *
 * @param type string
 */
export async function generateLibEntry(type: LibEntryType) {
  try {
    if (type === 'vue-components')
      await createVueLibraryEntryPoint()

    if (type === 'web-components')
      await createWebComponentLibraryEntryPoint()

    if (type === 'functions')
      await createFunctionLibraryEntryPoint()
  }
  catch (err) {
    log.error('There was an error generating the library entry point.', err)
    process.exit()
  }
}

export async function createVueLibraryEntryPoint() {
  log.info('Creating the Vue component library entry point...')

  await writeTextFile({
    path: libraryEntryPath('vue-components'),
    data: generateEntryPointData('vue-components'),
  })

  log.success('Created the Vue component library entry point.')
}

export async function createWebComponentLibraryEntryPoint() {
  log.info('Creating the Web Component library entry point...')

  await writeTextFile({
    path: libraryEntryPath('web-components'),
    data: generateEntryPointData('web-components'),
  })

  log.success('Created Web Component library entry point.')
}

export async function createFunctionLibraryEntryPoint() {
  log.info('Creating the Function library entry point...')

  await writeTextFile({
    path: libraryEntryPath('functions'),
    data: generateEntryPointData('functions'),
  })

  log.success('Created Functions library entry point.')
}

export function generateEntryPointData(type: 'vue-components' | 'web-components' | 'functions'): string {
  let arr = []

  if (type === 'functions') {
    if (!library.functions?.functions) {
      log.error('There are no functions defined to be built. Please check your config/library.ts file for potential adjustments.')
      process.exit()
    }

    for (const fx of library.functions?.functions) {
      if (Array.isArray(fx))
        arr.push(`export * as ${fx[1]} from '../../../functions/${fx[0]}'`)
      else
        arr.push(`export * from '../../../functions/${fx}'`)
    }

    // join the array into a string with each element being on a new line
    return arr.join('\r\n')
  }

  if (type === 'vue-components') {
    if (!library.vueComponents?.tags) {
      log.error('There are no components defined to be built. Please check your config/library.ts file for potential adjustments.')
      process.exit()
    }

    arr = determineResetPreset()

    for (const component of library.vueComponents?.tags.map(tag => tag.name)) {
      if (Array.isArray(component))
        arr.push(`export { default as ${component[1]} } from '../../../components/${component[0]}.vue'`)
      else
        arr.push(`export { default as ${component} } from '../../../components/${component}.vue'`)
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
    log.error('There are no components defined to be built. Please check your config/library.ts file for potential adjustments.')
    process.exit()
  }

  for (const component of library.webComponents?.tags.map(tag => tag.name)) {
    if (Array.isArray(component)) {
      imports.push(`import ${component[1]} from '../../../components/${component[0]}.vue'`)
      declarations.push(`const ${component[1]}CustomElement = defineCustomElement(${component[1]})`)
      definitions.push(`customElements.define('${kebabCase(component[1])}', ${component[1]}CustomElement)`)
    }
    else {
      imports.push(`import ${component} from '../../../components/${component}.vue'`)
      declarations.push(`const ${component}CustomElement = defineCustomElement(${component})`)
      definitions.push(`customElements.define('${kebabCase(component)}', ${component}CustomElement)`)
    }
  }

  // join the array into a string with each element being on a new line
  return [...imports, ...declarations, ...definitions].join('\r\n')
}
