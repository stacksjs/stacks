import { log } from '@stacksjs/logging'
import { hasComponents } from '@stacksjs/storage'
import { runNpmScript } from '@stacksjs/utils'
import { type ExamplesOptions, ExitCode, NpmScript } from '@stacksjs/types'

export async function invoke(options: ExamplesOptions) {
  if (options.components || options.vue)
    await componentExample(options)

  else if (options.webComponents || options.elements)
    await webComponentExample(options)

  else
    log.error('An unsupported option was used. Please try again, check the documentation & report the issue, if needed.')
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
    await runNpmScript(NpmScript.ExampleVue, options)
    log.success('Your component library was built successfully')
  }
  else {
    log.info('No components found.')
    // todo: throw custom error here
  }
}

export async function webComponentExample(options: ExamplesOptions) {
  if (hasComponents()) {
    log.info('Building your Web Component library...')
    await runNpmScript(NpmScript.BuildWebComponents, options)
    log.success('Your Web Component library was built successfully')
  }
  else {
    log.info('No components found.')
    // todo: throw custom error here
    process.exit(ExitCode.FatalError)
  }
}
