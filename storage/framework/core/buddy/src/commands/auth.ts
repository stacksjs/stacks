import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function auth(buddy: CLI): void {
  const descriptions = {
    setup: 'Set up authentication (migrations + personal access client)',
    token: 'Create a personal access client token',
    client: 'Create a new OAuth client',
    prune: 'Prune expired and revoked tokens',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  // auth:setup - Main setup command (like Laravel Passport's passport:install)
  buddy
    .command('auth:setup', descriptions.setup)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options) => {
      log.debug('Running `buddy auth:setup` ...', options)

      const perf = await intro('buddy auth:setup')
      const result = await runAction(Action.AuthSetup, options)

      if (result.isErr) {
        await outro(
          'While setting up authentication, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro('Authentication setup completed successfully.', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  // auth:token - Create personal access client (for backwards compatibility)
  buddy
    .command('auth:token', descriptions.token)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options) => {
      log.debug('Running `buddy auth:token` ...', options)

      const perf = await intro('buddy auth:token')
      const result = await runAction(Action.CreatePersonalAccessClient, options)

      if (result.isErr) {
        await outro(
          'While creating the personal access client token, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro('Personal access client token created successfully.', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  // auth:client - Create a new OAuth client
  buddy
    .command('auth:client', descriptions.client)
    .option('-n, --name [name]', 'Client name', { default: 'OAuth Client' })
    .option('-r, --redirect [redirect]', 'Redirect URI', { default: 'http://localhost' })
    .option('--personal', 'Create a personal access client', { default: false })
    .option('--password', 'Create a password grant client', { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options) => {
      log.debug('Running `buddy auth:client` ...', options)

      const perf = await intro('buddy auth:client')
      const result = await runAction(Action.AuthClient, options)

      if (result.isErr) {
        await outro(
          'While creating the OAuth client, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro('OAuth client created successfully.', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  // auth:prune - Prune expired and revoked tokens
  buddy
    .command('auth:prune', descriptions.prune)
    .option('--expired', 'Prune expired tokens (default: true)', { default: true })
    .option('--revoked', 'Prune revoked tokens (default: true)', { default: true })
    .option('-d, --days [days]', 'Prune revoked tokens older than N days', { default: 7 })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options) => {
      log.debug('Running `buddy auth:prune` ...', options)

      const perf = await intro('buddy auth:prune')
      const result = await runAction(Action.AuthPrune, options)

      if (result.isErr) {
        await outro(
          'While pruning tokens, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro('Token pruning completed successfully.', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy.on('auth:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
