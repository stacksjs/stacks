import type { IntroOptions, OutroOptions } from '@stacksjs/types'
import { version } from '../package.json'
import { log } from './console'
import { spinner } from './spinner'
import { bgCyan, bold, cyan, dim, green, italic, red } from './utilities'

/**
 * Prints the intro message.
 */
export function intro(command: string, options?: IntroOptions) {
  console.log()
  console.log(cyan(bold('Stacks CLI')) + dim(` v${version}`))
  console.log()

  log.info(`Preparing to run the  ${bgCyan(italic(bold(` ${command} `)))}  command.`)

  if (options?.showPerformance === false)
    return

  return performance.now()
}

/**
 * Prints the outro message.
 */
export function outro(text: string, options: OutroOptions, error?: Error) {
  if (options.isError) {
    if (error)
      log.error(error)
  }
  else { log.success(text) }

  if (options.startTime) {
    let time = performance.now() - options.startTime

    if (options.useSeconds) {
      time = time / 1000
      time = Math.round(time * 100) / 100 // https://stackoverflow.com/a/11832950/7811162
    }

    if (options.isError)
      log.error(red(`in ${time}${options.useSeconds ? 's' : 'ms'}`))
    else
      log.success(green(`Done in ${time}${options.useSeconds ? 's' : 'ms'}`))
  }
}

export function startAnimation() {
  const spin = spinner('Running...').start()
  const pleaseWait = 'This may take a little while...'

  setTimeout(() => {
    spin.text = italic(pleaseWait)
  }, 5000)

  return spin
}
