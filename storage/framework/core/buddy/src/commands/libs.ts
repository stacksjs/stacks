import type { CLI, CliOptions } from '@stacksjs/types'
import { relative } from 'node:path'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { bold, dim, log, onUnknownSubcommand } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'
import { resultFailed } from '../result'

interface LibsOptions extends CliOptions {
  json?: boolean
}

interface PublishOptions extends CliOptions {
  dryRun?: boolean
}

export function libs(buddy: CLI): void {
  const descriptions = {
    list: 'List the packages this project releases out of resources/functions and resources/components',
    build: 'Build every configured library package',
    publish: 'Publish the built library packages through pantry',
    json: 'Print the resolved packages as JSON',
    dryRun: 'Report what would be published without uploading anything',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('libs', descriptions.list)
    .alias('libs:list')
    .alias('libraries')
    .option('--json', descriptions.json, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy libs')
    .action(async (options: LibsOptions) => {
      // Imported here rather than at module scope: `buddy --help` renders the
      // whole command table, and resolving the library config for a command
      // nobody ran would load `config/library.ts` on every invocation.
      const { resolveLibraryPackages, LibraryConfigError } = await import('@stacksjs/actions')
      const { library } = await import('@stacksjs/config')

      try {
        const packages = await resolveLibraryPackages(library)

        if (options.json) {
          console.log(JSON.stringify(packages.map(pkg => ({
            name: pkg.name,
            kind: pkg.kind,
            dir: relative(process.cwd(), pkg.dir),
            private: pkg.private,
            runtime: pkg.runtime,
            sources: pkg.sources.map(source => relative(process.cwd(), source)),
          })), null, 2))
          return
        }

        if (!packages.length) {
          log.info('No library packages are configured. Add one to `packages` in config/library.ts.')
          return
        }

        for (const pkg of packages) {
          console.log(`${bold(pkg.name)} ${dim(`(${pkg.kind}${pkg.private ? ', private' : ''})`)}`)
          console.log(dim(`  → ${relative(process.cwd(), pkg.dir)}`))

          for (const source of pkg.sources)
            console.log(dim(`  · ${relative(process.cwd(), source)}`))
        }
      }
      catch (error) {
        if (error instanceof LibraryConfigError) {
          await log.exit(error.message, 1)
          return
        }

        throw error
      }
    })

  buddy
    .command('libs:build', descriptions.build)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions) => {
      const result = await runAction(Action.BuildLibs, options)

      if (resultFailed(result)) {
        log.error('Failed to build the library packages.', result.error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('libs:publish', descriptions.publish)
    .option('--dry-run', descriptions.dryRun, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy libs:publish --dry-run')
    .action(async (options: PublishOptions) => {
      const result = await runAction(Action.LibraryPublish, { ...options, verbose: true })

      if (resultFailed(result)) {
        log.error('Failed to publish the library packages.', result.error)
        process.exit(ExitCode.FatalError)
      }
    })

  onUnknownSubcommand(buddy, 'libs')
}
