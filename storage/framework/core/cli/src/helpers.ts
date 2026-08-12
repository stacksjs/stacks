import type { IntroOptions, OutroOptions } from '@stacksjs/types'
import { handleError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { ExitCode } from '@stacksjs/types'
import { bgCyan, bold, cyan, dim, gray, green, italic } from './utils'
import { version } from '../package.json'

// Re-export commonly used CLI utilities
export { log }
export { italic, bold, cyan, dim, gray, green } from './utils'

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
    if (error) {
      // Log the failure, then RESOLVE — previously this branch returned
      // `handleError(error)` without ever settling the promise, so every
      // `await outro(msg, opts, err)` hung at the await. With the event
      // loop drained the process then exited 0, masking real failures:
      // `buddy migrate` (and ~10 other commands) reported success when the
      // underlying action had failed. Resolving lets the caller reach its
      // own `process.exit(ExitCode.FatalError)` on the next line.
      handleError(error)
      return resolve(ExitCode.FatalError)
    }

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

    // Drain the log before resolving.
    //
    // Every one of these writes is async and tracked, and essentially every
    // caller does `await outro(...)` immediately followed by `process.exit()`.
    // `process.exit` does not run `beforeExit`, so the queued write is
    // discarded and the command's closing summary never appears — the logging
    // module documents that race as deliberately uncovered, leaving it to each
    // caller to flush, and callers do not.
    //
    // The visible cost was `buddy migrate` on a production box: it applied its
    // migrations and printed nothing at all, exit 0. An operator could not tell
    // "applied 3", "nothing to migrate" and "died early" apart, and the schema
    // silently stayed behind. Flushing here fixes it once for every command
    // that ends with an outro rather than once per call site.
    void log.flush().catch(() => {}).then(() => resolve(ExitCode.Success))
  })
}
