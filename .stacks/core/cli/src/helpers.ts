/* eslint-disable no-console */
import { ExitCode, type IntroOptions, type OutroOptions } from '@stacksjs/types'
import { isString } from '@stacksjs/validation'
import { log } from '@stacksjs/logging'
import pkgjson from '../package.json'
import { spinner } from './spinner'
import { bgCyan, bold, cyan, dim, green, italic, red } from './utilities'

const { version } = pkgjson

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

    log.info(`Preparing to run the  ${bgCyan(italic(bold(` ${command} `)))}  command`)

    if (options?.showPerformance === false || options?.quiet)
      return resolve(0)

    return resolve(performance.now())
  })
}

/**
 * Prints the outro message.
 */
export function outro(text: string, options: OutroOptions, error?: Error | string) {
  return new Promise((resolve) => {
    if (options.isError) {
      if (error)
        log.error(isString(error) ? new Error(error) : error)
    }
    else {
      if (options?.type === 'info')
        log.info(text)

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
        log.error(red(`in ${time}${options.useSeconds ? 's' : 'ms'}`))
      else
        log.success(green(`Done in ${time}${options.useSeconds ? 's' : 'ms'}`))
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
