import type { CLI, TinkerOptions } from '@stacksjs/types'
import process from 'node:process'
import { intro, log, outro } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

export function tinker(buddy: CLI): void {
  const descriptions = {
    tinker: 'Interactive REPL with Stacks framework preloaded',
    eval: 'Evaluate a single expression and exit',
    print: 'Evaluate, print, and exit',
    noBanner: 'Skip the welcome banner',
    preload: 'Additional modules to preload (comma-separated)',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('tinker', descriptions.tinker)
    .option('-e, --eval [expression]', descriptions.eval, { default: '' })
    .option('--print [expression]', descriptions.print, { default: '' })
    .option('--no-banner', descriptions.noBanner, { default: false })
    .option('--preload [modules]', descriptions.preload, { default: '' })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: TinkerOptions) => {
      log.debug('Running `buddy tinker` ...', options)

      const perf = await intro('buddy tinker')

      try {
        const { startTinker } = await import('@stacksjs/tinker')

        const preloadModules = typeof options.preload === 'string' && options.preload
          ? options.preload.split(',').map((m: string) => m.trim())
          : undefined

        const result = await startTinker({
          eval: typeof options.eval === 'string' && options.eval ? options.eval : undefined,
          print: typeof options.print === 'string' && options.print ? options.print : undefined,
          banner: options.noBanner !== true,
          preload: preloadModules,
          verbose: options.verbose === true,
        })

        if (result.exitCode !== 0) {
          await outro(
            'Tinker session ended with errors',
            { startTime: perf, useSeconds: true },
          )
          process.exit(ExitCode.FatalError)
        }

        await outro('Tinker session ended.', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.Success)
      }
      catch (error) {
        await outro(
          'While running the tinker command, there was an issue',
          { startTime: perf, useSeconds: true },
          error instanceof Error ? error : undefined,
        )
        process.exit(ExitCode.FatalError)
      }
    })

  buddy.on('tinker:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(ExitCode.FatalError)
  })
}
