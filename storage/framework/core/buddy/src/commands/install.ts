import type { CLI, InstallOptions } from '@stacksjs/types'
import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

export function install(buddy: CLI): void {
  const descriptions = {
    install: 'Install your dependencies',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('install', descriptions.install)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-v, --verbose', descriptions.verbose, { default: false })
    .action(async (options: InstallOptions) => {
      log.debug('Running `buddy install` ...', options)

      const result = await runCommand('bun install', {
        ...options,
        cwd: p.projectPath(),
      })

      // Surface install failures as a non-zero exit code so CI pipelines
      // (and shell `&&` chains like `buddy install && buddy build`) actually
      // halt when dependencies don't resolve. The previous version awaited
      // and discarded the result, leaving the parent process at exit 0
      // even when bun install crashed.
      if (result && typeof result === 'object' && 'isErr' in result && (result as { isErr?: () => boolean }).isErr?.()) {
        log.error('bun install failed')
        process.exit(ExitCode.FatalError)
      }
    })

  buddy.on('install:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
