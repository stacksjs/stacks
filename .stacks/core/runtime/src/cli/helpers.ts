import { bgCyan, bold, consola, cyan, dim, green, italic } from '@stacksjs/cli'
import { version } from '../../package.json'

/**
 * Prints the intro message.
 */
export function intro(command: string, showPerformance: boolean) {
  console.log()
  console.log(cyan(bold('Stacks CLI')) + dim(` v${version}`))
  console.log()

  consola.info(`Preparing to run the  ${bgCyan(italic(bold(` ${command} `)))}  command.`)

  if (showPerformance)
    return performance.now()
}

/**
 * Prints the outro message.
 */
export function outro(text: string, perf?: number) {
  consola.success(text)

  if (perf) {
    const time = performance.now() - perf
    consola.success(green(`Done in ${time}ms`))
  }
}
