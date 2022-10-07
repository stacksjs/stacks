import consola from 'consola'
import { resolve } from 'pathe'
import { determineResetPreset, kebabCase } from '../utils'
import { components, functions } from '../../../config/library'

/**
 * Based on the config values, this method
 * will generate the library entry points.
 * @param type
 */
export async function generateLibEntry(type: 'vue-components' | 'web-components' | 'functions') {
  if (type === 'vue-components')
    consola.info('Creating the Vue component library entry point...')
  else if (type === 'web-components')
    consola.info('Creating the Web Component library entry point...')
  else
    consola.info('Creating the function library entry point...')

  let path = process.cwd()
  if (path.includes('.stacks'))
    path = resolve(path, `./core/build/entries/${type}.ts`)
  else
    path = resolve(path, `./.stacks/core/build/entries/${type}.ts`)

  const data = generateEntryPointData(type)

  try {
    await writeTextFile({
      path,
      data,
    })

    if (type === 'vue-components')
      consola.success('Created the Vue component library entry point.')
    else if (type === 'web-components')
      consola.success('Created the Web Component library entry point.')
    else
      consola.success('Created the function library entry point.')
  }
  catch (err) {
    consola.error(err)
  }
}

function generateEntryPointData(type: 'vue-components' | 'web-components' | 'functions'): string {
  let arr = []

  if (type === 'functions') {
    for (const fx of functions) {
      if (Array.isArray(fx))
        arr.push(`export * as ${fx[1]} from '../../../../functions/${fx[0]}'`)
      else
        arr.push(`export * from '../../../../functions/${fx}'`)
    }

    // join the array into a string with each element being on a new line
    return arr.join('\r\n')
  }

  if (type === 'vue-components') {
    arr = determineResetPreset()

    for (const component of components) {
      if (Array.isArray(component))
        arr.push(`export { default as ${component[1]} } from '../../../../components/${component[0]}.vue'`)
      else
        arr.push(`export { default as ${component} } from '../../../../components/${component}.vue'`)
    }

    // join the array into a string with each element being on a new line
    return arr.join('\r\n')
  }

  // at this point, we know it is a Web Component we are building
  arr = determineResetPreset()
  const imports = [...arr, 'import { defineCustomElement } from \'vue\'']
  const declarations = []
  const definitions = []

  for (const component of components) {
    if (Array.isArray(component)) {
      imports.push(`import ${component[1]} from '../../../../components/${component[0]}.vue'`)
      declarations.push(`const ${component[1]}CustomElement = defineCustomElement(${component[1]})`)
      definitions.push(`customElements.define('${kebabCase(component[1])}', ${component[1]}CustomElement)`)
    }
    else {
      imports.push(`import ${component} from '../../../../components/${component}.vue'`)
      declarations.push(`const ${component}CustomElement = defineCustomElement(${component})`)
      definitions.push(`customElements.define('${kebabCase(component)}', ${component}CustomElement)`)
    }
  }

  // join the array into a string with each element being on a new line
  return [...imports, ...declarations, ...definitions].join('\r\n')
}
