import type { CLI, LintOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro, runCommand } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { path } from '@stacksjs/path'

export function lint(buddy: CLI): void {
  const descriptions = {
    lint: 'Automagically lints your project codebase',
    lintFix: 'Automagically fixes all lint errors',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('lint', descriptions.lint)
    .option('-f, --fix', descriptions.lintFix, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: LintOptions) => {
      log.debug('Running `buddy lint` ...', options)

      const startTime = await intro('buddy lint')

      if (options.fix)
        await runAction(Action.LintFix, { cwd: path.projectPath(), ...options })
      else await runCommand('bunx --bun eslint . --config ./config/lint.ts', { cwd: path.projectPath() })

      await outro('Linted your project', { startTime, useSeconds: true })
    })

  buddy
    .command('lint:fix', descriptions.lintFix)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: LintOptions) => {
      log.debug('Running `buddy lint:fix` ...', options)

      log.info('Fixing lint errors...')
      const result = await runAction(Action.LintFix, { cwd: path.projectPath(), ...options })

      if (result.isErr()) {
        log.error('There was an error lint fixing your code.', result.error)
        process.exit()
      }

      log.success('Fixed lint errors')
    })

  buddy.on('lint:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
