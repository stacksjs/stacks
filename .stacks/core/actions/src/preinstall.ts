import process from 'node:process'
import { log } from '@stacksjs/logging'

// import type { PreinstallOptions } from '@stacksjs/types'

// import { determineDebugLevel } from '@stacksjs/utils'

// export async function invoke(options?: PreinstallOptions) {
export async function invoke() {
  try {
    // const stdio = determineDebugLevel(options) ? 'inherit' : 'ignore'

    log.info('Preinstall check...')
    // await spawn('bunx only-allow pnpm', { stdio, cwd: projectPath() })
    log.success('Environment ready')
  }
  catch (error) {
    log.error('There was an error pre-installing your stack.', error)
    process.exit()
  }
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function preinstall() {
  return invoke()
}
