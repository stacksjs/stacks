import type { CLI } from '@stacksjs/types'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { confirm, log } from '@stacksjs/cli'
import { hasTTY, isCI } from '@stacksjs/env'
import { ExitCode } from '@stacksjs/types'

/**
 * `buddy gdpr:*` - data-subject requests and the processing register
 * (stacksjs/stacks#365).
 *
 * Everything here reads the same model declarations (`personal` attributes and
 * the `gdpr` trait) through `@stacksjs/orm`, so what `gdpr:register` says the
 * application does with personal data is what `gdpr:erase` and `gdpr:prune`
 * actually do.
 *
 * Personal data goes to stdout or to the file asked for, never through `log`:
 * `log` writes to a file in production, and an export written there would be
 * a second copy nobody tracks.
 */

const DEFAULT_REGISTER = 'database/processing-register'

interface ChangeRow {
  model: string
  table: string
  action: string
  matched: number
  changed: number
  fields: string[]
}

function printChanges(changes: ChangeRow[], dryRun: boolean): void {
  if (!changes.length) {
    process.stdout.write('  Nothing declared for this request.\n')
    return
  }
  const verb = dryRun ? 'would change' : 'changed'
  const width = Math.max(...changes.map(change => change.model.length))
  for (const change of changes) {
    const fields = change.fields.length ? `  (${change.fields.join(', ')})` : ''
    process.stdout.write(`  ${change.model.padEnd(width)}  ${change.action.padEnd(9)}  ${String(change.matched).padStart(5)} matched  ${String(change.changed).padStart(5)} ${verb}${fields}\n`)
  }
}

async function fail(message: string): Promise<never> {
  await log.error(message)
  await log.flush()
  process.exit(ExitCode.FatalError)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function registerPath(format: string, out?: string): string {
  return resolve(process.cwd(), out || `${DEFAULT_REGISTER}.${format === 'json' ? 'json' : 'md'}`)
}

async function renderRegister(format: string): Promise<string> {
  const { buildProcessingRegister, loadGdprModels, renderProcessingRegister, resolveGdprPlan } = await import('@stacksjs/orm')
  const plan = resolveGdprPlan(await loadGdprModels())
  if (plan.problems.length)
    await fail(`GDPR declarations cannot be honoured:\n${plan.problems.map(p => `  - ${p.model}: ${p.message}`).join('\n')}`)
  return renderProcessingRegister(buildProcessingRegister(plan), format === 'json' ? 'json' : 'markdown')
}

export function gdpr(buddy: CLI): void {
  buddy
    .command('gdpr:export <subject>', 'Export a data subject\'s personal data as JSON (user id, email or uuid)')
    .option('--out <file>', 'Write the export to this file instead of stdout')
    .example('buddy gdpr:export ada@example.com --out ada.json')
    .action(async (subject: string, options: { out?: string }) => {
      const { exportSubjectData } = await import('@stacksjs/orm')
      let result
      try {
        result = await exportSubjectData(subject, { actor: 'cli' })
      }
      catch (error) {
        return fail(errorMessage(error))
      }

      const json = `${JSON.stringify(result, null, 2)}\n`
      if (options.out) {
        const file = resolve(process.cwd(), options.out)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, json, { mode: 0o600 })
        log.success(`Exported ${Object.keys(result.data).length} model(s) for subject ${String(result.subject.id)} to ${file}`)
      }
      else {
        process.stdout.write(json)
      }
      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('gdpr:erase <subject>', 'Erase a data subject: delete or anonymize their rows per each model\'s declaration')
    .option('--dry-run', 'Print exactly what would change, and change nothing', { default: false })
    .option('-y, --yes', 'Skip the confirmation prompt', { default: false })
    .example('buddy gdpr:erase ada@example.com --dry-run')
    .example('buddy gdpr:erase 42 --yes')
    .action(async (subject: string, options: { dryRun?: boolean, yes?: boolean }) => {
      const { eraseSubject } = await import('@stacksjs/orm')

      // Always preview first: the confirmation is only worth anything if it
      // says what it is confirming.
      let preview
      try {
        preview = await eraseSubject(subject, { dryRun: true })
      }
      catch (error) {
        return fail(errorMessage(error))
      }

      process.stdout.write(`\nErasure of subject ${String(preview.subject.id)}:\n`)
      printChanges(preview.changes, true)
      if (preview.skipped.length)
        process.stdout.write(`  Not in this database: ${preview.skipped.join(', ')}\n`)
      process.stdout.write('\n')

      if (options.dryRun) {
        log.info('Dry run: nothing was changed.')
        await log.flush()
        process.exit(ExitCode.Success)
      }

      if (!options.yes) {
        if (isCI || !hasTTY)
          return fail('Refusing to erase without confirmation in a non-interactive environment. Re-run with --yes.')
        await log.flush()
        const proceed = await confirm({ message: 'Erase this subject? This cannot be undone.', initial: false })
        if (!proceed) {
          log.info('Cancelled. Nothing was changed.')
          await log.flush()
          process.exit(ExitCode.Success)
        }
      }

      let result
      try {
        result = await eraseSubject(subject, { actor: 'cli' })
      }
      catch (error) {
        return fail(errorMessage(error))
      }

      printChanges(result.changes, false)
      log.success(`Erased subject ${String(result.subject.id)} and recorded it in gdpr_requests.`)
      log.info(result.credentialsRevoked
        ? 'Their API tokens are revoked and their sessions destroyed.'
        : 'Credentials were not revoked: @stacksjs/auth is not available, or the subject key is not numeric.')
      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('gdpr:prune', 'Apply every model\'s retention policy (the daily PruneRetainedDataJob does the same)')
    .option('--dry-run', 'Print what would be pruned, and change nothing', { default: false })
    .action(async (options: { dryRun?: boolean }) => {
      const { pruneRetainedData } = await import('@stacksjs/orm')
      let result
      try {
        result = await pruneRetainedData({ dryRun: options.dryRun === true, actor: 'cli' })
      }
      catch (error) {
        return fail(errorMessage(error))
      }

      if (!result.changes.length && !result.skipped.length) {
        log.info('No model declares a retention policy.')
      }
      else {
        printChanges(result.changes, result.dryRun)
        if (result.skipped.length)
          process.stdout.write(`  Not in this database: ${result.skipped.join(', ')}\n`)
        log.info(result.dryRun ? 'Dry run: nothing was changed.' : 'Retention applied.')
      }
      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('gdpr:register', 'Generate the processing register from the model declarations')
    .option('--format <format>', 'markdown or json', { default: 'markdown' })
    .option('--out <file>', `Where to write it. Defaults to ${DEFAULT_REGISTER}.md (or .json)`)
    .option('--stdout', 'Print it instead of writing a file', { default: false })
    .action(async (options: { format?: string, out?: string, stdout?: boolean }) => {
      const format = options.format === 'json' ? 'json' : 'markdown'
      const rendered = await renderRegister(format)
      if (options.stdout) {
        process.stdout.write(rendered)
        process.exit(ExitCode.Success)
      }
      const file = registerPath(format, options.out)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, rendered)
      log.success(`Wrote ${file}`)
      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('gdpr:register:check', 'Verify the committed processing register matches the model declarations')
    .option('--format <format>', 'markdown or json', { default: 'markdown' })
    .option('--out <file>', `The register to check. Defaults to ${DEFAULT_REGISTER}.md (or .json)`)
    .action(async (options: { format?: string, out?: string }) => {
      const format = options.format === 'json' ? 'json' : 'markdown'
      const file = registerPath(format, options.out)
      if (!existsSync(file))
        return fail(`${file} does not exist. Run \`buddy gdpr:register\` and commit it.`)
      const rendered = await renderRegister(format)
      if (readFileSync(file, 'utf8') !== rendered)
        return fail(`${file} is out of date with the model declarations. Run \`buddy gdpr:register\` and commit the result.`)
      log.success(`${file} is current.`)
      await log.flush()
      process.exit(ExitCode.Success)
    })
}
