import type { ExamplesOptions } from '@stacksjs/types'
import process from 'node:process'
import { NpmScript } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { hasComponents } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'
import { runNpmScript } from '@stacksjs/utils'

export async function invoke(options: ExamplesOptions): Promise<void> {
  if (options.components || options.vue) {
    await componentExample(options)
  }
  else if (options.webComponents || options.elements) {
    await webComponentExample(options)
  }
  else {
    log.error(
      'An unsupported option was used. Please try again, check the documentation & report the issue, if needed.',
    )
  }
}

export async function examples(options: ExamplesOptions): Promise<void> {
  return await invoke(options)
}

export async function componentExample(options: ExamplesOptions): Promise<void> {
  if (hasComponents()) {
    await runNpmScript(NpmScript.ExampleVue, options)
    log.success('Your component library was built successfully')
  }
  else {
    log.info('No components found.')
    // todo: throw custom error here
  }
}

export async function webComponentExample(options: ExamplesOptions): Promise<void> {
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
