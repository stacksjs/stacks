import type { CLI, TinkerOptions } from '@stacksjs/types'
import process from 'node:process'
import { intro, log, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { ExitCode } from '@stacksjs/types'

export function tinker(buddy: CLI): void {
  const descriptions = {
    tinker: 'Interactive REPL with Stacks framework preloaded',
    eval: 'Evaluate a single expression and exit',
    print: 'Evaluate, print, and exit',
    noBanner: 'Skip the welcome banner',
    preload: 'Additional modules to preload (comma-separated)',
    project: 'Run in this project directory instead of the current one',
    serve: 'Speak the frame protocol on stdio (JSON requests in, frames out) for tools that drive a session',
    bare: 'Do not boot the app: a plain Bun session',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('tinker', descriptions.tinker)
    .option('-e, --eval [expression]', descriptions.eval, { default: '' })
    .option('--print [expression]', descriptions.print, { default: '' })
    .option('--no-banner', descriptions.noBanner)
    .option('--preload [modules]', descriptions.preload, { default: '' })
    .option('--project [path]', descriptions.project, { default: '' })
    .option('--serve', descriptions.serve, { default: false })
    .option('--bare', descriptions.bare, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: TinkerOptions) => {
      // A served session owns stdout: every line on it is a frame. The
      // command's own intro and outro would corrupt the stream, so it stays
      // silent and reports through the exit code.
      if (options.serve === true) {
        const { startTinker } = await import('@stacksjs/tinker')
        const once = typeof options.print === 'string' && options.print
          ? options.print
          : typeof options.eval === 'string' && options.eval ? options.eval : undefined
        const result = await startTinker({
          serve: true,
          eval: once,
          cwd: typeof options.project === 'string' && options.project ? options.project : undefined,
          stacksPreload: options.bare !== true,
        })
        process.exit(result.exitCode === 0 ? ExitCode.Success : ExitCode.FatalError)
      }

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
          // cac reads `--no-banner` as `banner: false`; nothing sets `noBanner`.
          banner: options.banner !== false,
          preload: preloadModules,
          verbose: options.verbose === true,
          cwd: typeof options.project === 'string' && options.project ? options.project : undefined,
          stacksPreload: options.bare !== true,
        })

        if (result.exitCode !== 0) {
          await outro(
            'Tinker session ended with errors',
            { startTime: perf, useSeconds: true, type: 'error' },
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

  onUnknownSubcommand(buddy, "tinker")
}
