import process from 'node:process'
import { log } from 'stacks:logging'
import { hasComponents } from 'stacks:storage'
import { runNpmScript } from 'stacks:utils'
import type { ExamplesOptions } from 'stacks:types'
import { ExitCode } from 'stacks:types'
import { NpmScript } from 'stacks:enums'

export async function invoke(options: ExamplesOptions) {
  if (options.components || options.vue)
    await componentExample(options)

  else if (options.webComponents || options.elements)
    await webComponentExample(options)

  else
    log.error('An unsupported option was used. Please try again, check the documentation & report the issue, if needed.')
}

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
