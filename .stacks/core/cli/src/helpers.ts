/* eslint-disable no-console */
import { ExitCode, type IntroOptions, type OutroOptions } from '@stacksjs/types'
import { handleError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { version } from '../package.json'
import { spinner } from './spinner'
import { bgCyan, bold, cyan, dim, italic } from './utilities'

/**
 * Prints the intro message.
 */
export async function intro(command: string, options?: IntroOptions): Promise<number> {
  return new Promise((resolve) => {
    if (options?.quiet === false) {
      console.log()
      console.log(cyan(bold('Stacks CLI')) + dim(` v${version}`))
      console.log()
    }

    log.info(`Preparing to run  ${bgCyan(italic(bold(` ${command} `)))}`)

    if (options?.showPerformance === false || options?.quiet)
      return resolve(0)

    return resolve(performance.now())
  })
}

/**
 * Prints the outro message.
 */
export function outro(text: string, options: OutroOptions, error?: Error | string) {
  const successMessage = options?.successMessage

  return new Promise((resolve) => {
    if (options.isError) {
      if (error)
        handleError(error)
    }
    else {
      if (options?.type === 'info')
        log.info(text)

      // the following condition triggers in the case of "Cleaned up" messages
      if (options?.successMessage !== text)
        log.success(text)
    }

    if (options.startTime) {
      let time = performance.now() - options.startTime

      if (options.useSeconds) {
        time = time / 1000
        time = Math.round(time * 100) / 100 // https://stackoverflow.com/a/11832950/7811162
      }

      if (options.quiet === true)
        return resolve(ExitCode.Success)

      if (options.isError)
        log.error(`[${time.toFixed(2)}${options.useSeconds ? 's' : 'ms'}] Failed`)
      else
        log.success((`[${time.toFixed(2)}${options.useSeconds ? 's' : 'ms'}] ${successMessage ?? 'Complete'}`))
    }

    return resolve(ExitCode.Success)
  })
}

export function startSpinner(text?: string) {
  if (!text)
    text = 'Executing...'

  const spin = spinner({
    text,
  }).start()

  setTimeout(() => {
    spin.text = italic('This may take a few moments...')
    spin.spinner = 'clock'
  }, 7500)

  return spin
}
