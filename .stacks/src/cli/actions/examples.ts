import { consola } from '@stacksjs/cli'
import { hasComponents } from '@stacksjs/storage'
import { runNpmScript } from '@stacksjs/utils'
import { type ExamplesOptions, NpmScript } from '@stacksjs/types'

export async function invoke(options: ExamplesOptions) {
  if (options.components || options.vue)
    await componentExample()

  else if (options.webComponents || options.elements)
    await webComponentExample()
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function examples(options: ExamplesOptions) {
  return invoke(options)
}

export async function componentExample() {
  if (hasComponents()) {
    try {
      await runNpmScript(NpmScript.ExampleVue)
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

export async function webComponentExample() {
  consola.info('Building your Web Component library...')

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
