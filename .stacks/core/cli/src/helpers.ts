import { debugLevel } from '@stacksjs/config'
import type { CliOptions, IntroOptions, OutroOptions, SpinnerOptions as Spinner } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { version } from '../package.json'
import { log } from './console'
import { spinner } from './spinner'
import { bgCyan, bold, cyan, dim, green, italic, red } from './utilities'

/**
 * Prints the intro message.
 */
export function intro(command: string, options: IntroOptions) {
  console.log()
  console.log(cyan(bold('Stacks CLI')) + dim(` v${version}`))
  console.log()

  log.info(`Preparing to run the  ${bgCyan(italic(bold(` ${command} `)))}  command.`)

  if (options.showPerformance === false)
    return

  return performance.now()
}

/**
 * Prints the outro message.
 */
export function outro(text: string, options: OutroOptions) {
  if (options.isError)
    log.error(text)
  else
    log.success(text)

  if (options.startTime) {
    let time = performance.now() - options.startTime

    if (options.useSeconds) {
      time = time / 1000
      time = Math.round(time * 100) / 100 // https://stackoverflow.com/a/11832950/7811162
    }

    if (options.isError) {
      log.error(red(`in ${time}${options.useSeconds ? 's' : 'ms'}`))
      process.exit(ExitCode.FatalError)
    }

    else {
      log.success(green(`Done in ${time}${options.useSeconds ? 's' : 'ms'}`))
      process.exit(ExitCode.Success)
    }
  }
}

export function animatedLoading(options?: CliOptions) {
  const debug = debugLevel(options)
  const pleaseWait = 'This may take a little while...'
  let spin = options?.animatedLoading

  // the spinner is not shown when debug output is being inherited
  if (debug !== 'inherit' && typeof spin === 'object') {
    if (spin.isSpinning) {
      setTimeout(() => {
        (spin as Spinner).text = italic(pleaseWait)
      }, 5000)
      return
    }

    // this triggers when options.shortLived === false and options.animatedLoading === true
    spin = spinner('Running...').start()
    setTimeout(() => {
      (spin as Spinner).text = italic(pleaseWait)
    }, 5000)
  }
}
