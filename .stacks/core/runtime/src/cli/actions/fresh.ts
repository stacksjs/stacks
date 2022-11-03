import { bgCyan, bold, consola, cyan, dim, italic, spawn, spinner } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { type CliOptions as FreshOptions } from '@stacksjs/types'
import { debugLevel } from '@stacksjs/config'
import { version } from '../../../package.json'

export async function invoke(options?: FreshOptions) {
  const debug = debugLevel(options)

  console.log()
  console.log(cyan(bold('Stacks CLI')) + dim(` v${version}`))
  console.log()

  consola.info(`Preparing to run the  ${bgCyan(italic(bold(' stx fresh ')))}  command.`)
  const spin = spinner('Running...').start()
  setTimeout(() => {
    spin.text = italic('This may take a little while...')
  }, 15000)

  await spawn('pnpm run clean', { stdio: debug, cwd: projectPath() })
  await spawn('pnpm install', { stdio: debug, cwd: projectPath() })

  spin.stop()
  consola.success('Freshly reinstalled your dependencies.')
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function fresh(options: FreshOptions) {
  return invoke(options)
}
