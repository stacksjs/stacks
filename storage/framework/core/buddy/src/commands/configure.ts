import type { CLI, ConfigureOptions } from '@stacksjs/types'
import process from 'node:process'
import { log, outro, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

export function configure(buddy: CLI): void {
  const descriptions = {
    configure: 'Configure options',
    aws: 'Configure the AWS connection',
    project: 'Target a specific project',
    profile: 'The AWS profile to use',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('configure', descriptions.configure)
    .option('--aws', descriptions.aws, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options?: ConfigureOptions) => {
      log.debug('Running `buddy configure` ...', options)

      if (options?.aws) {
        await configureAws(options)
        process.exit(ExitCode.Success)
      }

      log.info('Not implemented yet. Please use the --aws flag to configure AWS.')
      process.exit(ExitCode.Success)
    })

  buddy
    .command('configure:aws', descriptions.aws)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--profile', descriptions.profile, {
      default: process.env.AWS_PROFILE,
    })
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--access-key-id', 'The AWS access key')
    .option('--secret-access-key', 'The AWS secret access key')
    .option('--region', 'The AWS region')
    .option('--output', 'The AWS output format')
    .option('--quiet', 'Suppress output')
    .action(async (options?: ConfigureOptions) => {
      log.debug('Running `buddy configure:aws` ...', options)
      await configureAws(options)
      process.exit(ExitCode.Success)
    })

  buddy.on('configure:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(ExitCode.FatalError)
  })
}

async function configureAws(options?: ConfigureOptions) {
  const startTime = performance.now()

  const awsAccessKeyId = options?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID
  const awsSecretAccessKey = options?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY
  const defaultRegion = 'us-east-1' // we only support `us-east-1` for now
  const defaultOutputFormat = options?.output ?? 'json'

  const profile = process.env.AWS_PROFILE ?? options?.profile
  const command = profile ? `aws configure --profile ${profile}` : `aws configure`
  const input = `${awsAccessKeyId}\n${awsSecretAccessKey}\n${defaultRegion}\n${defaultOutputFormat}\n`

  const result = await runCommand(command, {
    cwd: p.projectPath(),
    stdin: 'pipe', // set stdin mode to 'pipe' to write to it
    input, // the actual input to write
  })

  if (result.isErr()) {
    await outro('While running the cloud command, there was an issue', { startTime, useSeconds: true }, result.error)
    process.exit(ExitCode.FatalError)
  }

  if (options?.quiet)
    return

  await outro('Exited', { startTime, useSeconds: true })
}
