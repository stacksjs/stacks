import { consola } from '@stacksjs/cli'
import { hasComponents } from '@stacksjs/storage'
import { runNpmScript } from '@stacksjs/utils'
import { type ExamplesOptions, ExitCode, NpmScript } from '@stacksjs/types'

export async function invoke(options: ExamplesOptions) {
  if (options.components || options.vue)
    await componentExample(options)

  else if (options.webComponents || options.elements)
    await webComponentExample(options)

  else
    consola.error('An unsupported option was used. Please try again, check the documentation & report the issue, if needed.')
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function examples(options: ExamplesOptions) {
  return invoke(options)
}

export async function componentExample(options: ExamplesOptions) {
  if (hasComponents()) {
    try {
      await runNpmScript(NpmScript.ExampleVue, options)
      consola.success('Your component library was built successfully.')
    }
    catch (error) {
      consola.error('There was an error building your component library.')
      consola.error(error)
      process.exit(ExitCode.FatalError)
    }
  }
  else {
    consola.info('No components found.')
    process.exit(ExitCode.FatalError)
  }
}

export async function webComponentExample(options: ExamplesOptions) {
  if (hasComponents()) {
    try {
      consola.info('Building your Web Component library...')
      await runNpmScript(NpmScript.BuildWebComponents, options)
      consola.success('Your Web Component library was built successfully.')
    }
    catch (error) {
      consola.error('There was an error building your Web Component library.')
      consola.error(error)
      process.exit(ExitCode.FatalError)
    }
  }
  else {
    consola.info('No components found.')
    process.exit(ExitCode.FatalError)
  }
}
