/**
 * `./buddy migrate:project <target> --from=<framework> --source=<path>`
 * — port an existing project from another framework into Stacks
 * (stacksjs/stacks#1241).
 *
 * The CLI is intentionally non-destructive: it never deletes anything
 * in the target, only writes new files. Re-runs are safe — they
 * overwrite emitted SQL / `defineModel` files but leave hand-written
 * code (routes, actions, views) alone.
 *
 * The report (always written to `<target>/MIGRATION_REPORT.md`)
 * doubles as the user's checklist for surfaces we didn't port.
 */

import type { CLI } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { log, onUnknownSubcommand } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import { DRIVERS, renderReport, runMigrator } from '../migrators'
import type { SourceFramework } from '../migrators/types'

interface MigrateProjectOptions {
  from?: string
  source?: string
  dryRun?: boolean
  verbose?: boolean
}

export function migrateProject(buddy: CLI): void {
  buddy
    .command('migrate:project [target]', 'Port an existing project (Laravel, Rails) into a Stacks project.')
    .option('--from <framework>', `Source framework — one of: ${Object.keys(DRIVERS).join(', ')}`, { default: 'laravel' })
    .option('--source <path>', 'Path to the existing source project. Defaults to the current working directory.', { default: false })
    .option('--dry-run', 'Show what would be translated without writing files.', { default: false })
    .option('--verbose', 'Print the per-entry table after the summary.', { default: false })
    .action(async (target: string | undefined, options: MigrateProjectOptions) => {
      const from = (options.from ?? 'laravel') as SourceFramework
      if (!(from in DRIVERS)) {
        log.error(`Unknown source framework: '${from}'. Supported: ${Object.keys(DRIVERS).join(', ')}.`)
        process.exit(ExitCode.FatalError)
      }

      const sourcePath = options.source ? resolve(process.cwd(), String(options.source)) : process.cwd()
      if (!existsSync(sourcePath)) {
        log.error(`Source project not found: ${sourcePath}`)
        process.exit(ExitCode.FatalError)
      }

      const targetPath = target
        ? resolve(process.cwd(), target)
        : process.cwd()

      log.info(`Migrating ${from} project: ${sourcePath} → ${targetPath}`)
      if (options.dryRun) log.info('(dry run — no files will be written)')

      try {
        const report = await runMigrator({
          source: sourcePath,
          target: targetPath,
          from,
          dryRun: options.dryRun === true,
        })

        const translated = report.entries.filter(e => e.status === 'translated').length
        const copied = report.entries.filter(e => e.status === 'copied').length
        const skipped = report.entries.filter(e => e.status === 'skipped').length
        const failed = report.entries.filter(e => e.status === 'failed').length

        log.info(`Translated: ${translated} | Copied: ${copied} | Skipped: ${skipped} | Failed: ${failed}`)

        if (options.verbose) {
          for (const e of report.entries) {
            const arrow = e.target ? ` → ${e.target}` : ''
            const note = e.note ? ` — ${e.note}` : ''
            log.info(`  [${e.status}] ${e.source}${arrow}${note}`)
          }
        }

        if (!options.dryRun) {
          const reportPath = join(targetPath, 'MIGRATION_REPORT.md')
          await writeFile(reportPath, renderReport(report))
          log.success(`Report written to ${reportPath}`)
        }

        process.exit(ExitCode.Success)
      }
      catch (err) {
        log.error(`Migration failed: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  onUnknownSubcommand(buddy, 'migrate:project')
}
