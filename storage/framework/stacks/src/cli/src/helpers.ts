/* eslint-disable no-console */
import { config } from 'src/config/src'
import { handleError } from 'src/error-handling/src'
import { log } from 'src/logging/src'
import type { IntroOptions, OutroOptions } from 'src/types/src'
import { ExitCode } from 'src/types/src'
import { version } from '../package.json'
import { bgCyan, bold, cyan, dim, gray, green, italic } from './utilities'

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

    let msg = `Preparing to run  ${bgCyan(italic(bold(` ${command} `)))}`
    if (command === 'buddy deploy')
      msg = `Preparing to run  ${bgCyan(italic(bold(` ${command} `)))}  for ${bold(`${config.app.name}`)} ${italic(`via ${config.app.url}`)}`

    log.info(msg)

    if (options?.showPerformance === false || options?.quiet)
      return resolve(0)

    return resolve(performance.now())
  })
}

/**
 * Prints the outro message.
 */
export function outro(text: string, options: OutroOptions, error?: Error | string) {
  const message = options?.message || text

  return new Promise((resolve) => {
    if (error)
      return handleError(error)

    if (options.startTime) {
      let time = performance.now() - options.startTime

      if (options.useSeconds) {
        time = time / 1000
        time = Math.round(time * 100) / 100 // https://stackoverflow.com/a/11832950/7811162
      }

      if (options.quiet === true)
        return resolve(ExitCode.Success)

      if (error)
        log.error(`[${time.toFixed(2)}${options.useSeconds ? 's' : 'ms'}] Failed`)
      else if (options.type === 'info')
        console.log(`${dim(gray(`[${time.toFixed(2)}${options.useSeconds ? 's' : 'ms'}]`))} ${message ?? 'Complete'}`)
      else
        console.log(`${dim(gray(bold(`[${time.toFixed(2)}${options.useSeconds ? 's' : 'ms'}]`)))} ${bold(green(message ?? 'Complete'))}`)
    }

    else {
      if (options?.type === 'info')
        console.log(text)

      // the following condition triggers in the case of "Cleaned up" messages
      else if (message !== text)
        log.success(text)
    }

    return resolve(ExitCode.Success)
  })
}

// export function startSpinner(text?: string) {
//   if (!text)
//     text = 'Executing...'

//   const spin = spinner({
//     text,
//   }).start()

//   setTimeout(() => {
//     spin.text = italic('This may take a few moments...')
//     spin.spinner = 'clock'
//   }, 7500)

//   return spin
// }
