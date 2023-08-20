import process from 'node:process'
import { type CLI, type DeployOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'

export function deploy(buddy: CLI) {
  const descriptions = {
    deploy: 'Reinstalls your npm dependencies',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('deploy', descriptions.deploy)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DeployOptions) => {
      const perf = await intro('buddy deploy')
      const result = await runAction(Action.Deploy, options)

      if (result.isErr()) {
        await outro('While running the `buddy deploy`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error as Error)
        process.exit()
      }

      await outro('Deployment succeeded.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('deploy:domains', descriptions.deploy)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DeployOptions) => {
      const perf = await intro('buddy deploy:domains')
      const result = await runAction(Action.Deploy, { ...options, domains: true, verbose: options.verbose })

      if (result.isErr()) {
        await outro('While running the `buddy deploy`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
        process.exit()
      }

      await outro('Deployment succeeded.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}
