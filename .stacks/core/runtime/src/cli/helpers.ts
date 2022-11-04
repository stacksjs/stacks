import { bgCyan, bold, consola, cyan, dim, green, italic } from '@stacksjs/cli'
import { version } from '../../package.json'

/**
 * Prints the intro message.
 */
export function intro(command: string, showPerformance?: boolean) {
  console.log()
  console.log(cyan(bold('Stacks CLI')) + dim(` v${version}`))
  console.log()

  consola.info(`Preparing to run the  ${bgCyan(italic(bold(` ${command} `)))}  command.`)

  if (showPerformance === false)
    return

  return performance.now()
}

interface OutroOptions {
  startTime?: number
  useSeconds?: boolean
}
/**
 * Prints the outro message.
 */
export function outro(text: string, options: OutroOptions) {
  consola.success(text)

  if (options.startTime) {
    let time = performance.now() - options.startTime

    if (options.useSeconds) {
      time = time / 1000
      time = Math.round(time * 100) / 100 // https://stackoverflow.com/a/11832950/7811162
    }

    consola.success(green(`Done in ${time}${options.useSeconds ? 's' : 'ms'}`))
  }
}
