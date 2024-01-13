import process from 'node:process'
import type { CLI, ConfigureOptions } from '@stacksjs/types'
import { log, outro, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { config } from '@stacksjs/config'
import { ExitCode } from '@stacksjs/types'

export function configure(buddy: CLI) {
  const descriptions = {
    configure: 'Configure options',
    aws: 'Configure the AWS connection',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('configure', descriptions.configure)
    .option('--aws', descriptions.aws, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options?: ConfigureOptions) => {
      if (options?.aws) {
        const startTime = performance.now()
        const result = await runCommand('aws configure', {
          ...options,
          cwd: p.projectPath(),
          stdin: 'inherit',
        })

        if (result.isErr()) {
          await outro('While running the configure command, there was an issue', { startTime, useSeconds: true }, result.error)
          process.exit(ExitCode.FatalError)
        }

        await outro('Exited', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      log.info('Not implemented yet. Please use the --aws flag to configure AWS.')
      process.exit(ExitCode.Success)
    })

  buddy
    .command('configure:aws', descriptions.aws)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options?: ConfigureOptions) => {
      const startTime = performance.now()
      const result = await runCommand(`aws configure --profile ${config.app.url}`, {
        ...options,
        cwd: p.cloudPath(),
        stdin: 'inherit',
      })

      if (result.isErr()) {
        await outro('While running the cloud command, there was an issue', { startTime, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Exited', { startTime, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy.on('configure:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(ExitCode.FatalError)
  })
}
