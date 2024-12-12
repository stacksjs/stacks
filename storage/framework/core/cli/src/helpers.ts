import type { IntroOptions, OutroOptions } from '@stacksjs/types'
import { handleError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { ExitCode } from '@stacksjs/types'
import { bgCyan, bold, cyan, dim, gray, green, italic } from 'kolorist'
import { version } from '../package.json'

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

    log.info(`Running  ${bgCyan(italic(bold(` ${command} `)))}`)

    if (options?.showPerformance === false || options?.quiet)
      return resolve(0)

    return resolve(performance.now())
  })
}

/**
 * Prints the outro message.
 */
export function outro(text: string, options?: OutroOptions, error?: Error | string): Promise<number> {
  const opts = {
    type: 'success',
    useSeconds: true,
    ...options,
  }

  opts.message = options?.message || text

  return new Promise((resolve) => {
    if (error)
      return handleError(error)

    if (opts?.startTime) {
      let time = performance.now() - opts.startTime

      if (opts.useSeconds) {
        time = time / 1000
        time = Math.round(time * 100) / 100 // https://stackoverflow.com/a/11832950/7811162
      }

      if (opts.quiet === true)
        return resolve(ExitCode.Success)

      if (error) {
        log.error(`[${time.toFixed(2)}${opts.useSeconds ? 's' : 'ms'}] Failed`)
      }
      else if (opts.type === 'info') {
        log.info(`${dim(gray(`[${time.toFixed(2)}${opts.useSeconds ? 's' : 'ms'}]`))} ${opts.message ?? 'Complete'}`)
      }
      else {
        log.success(
          `${dim(gray(bold(`[${time.toFixed(2)}${opts.useSeconds ? 's' : 'ms'}]`)))} ${bold(
            green(opts.message ?? 'Complete'),
          )}`,
        )
      }
    }
    else {
      if (opts?.type === 'info')
        log.info(text)
      // the following condition triggers in the case of "Cleaned up" messages
      else if (opts?.type === 'success' && opts?.quiet !== true)
        log.success(text)
    }

    return resolve(ExitCode.Success)
  })
}
