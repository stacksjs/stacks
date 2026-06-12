/**
 * Dev-time auto-migrate watcher.
 *
 * Watches the model directories (`app/Models`, `storage/framework/models`) and,
 * on a change, reconciles the database to match the models — generating and
 * applying the diff automatically so a developer never has to remember to run
 * `buddy migrate` after editing a model.
 *
 * Safety: destructive changes (drop column/table, lossy type change) are NEVER
 * auto-applied in the background — they're logged and skipped, prompting the
 * developer to run `buddy migrate` (which gates them behind confirmation).
 *
 * Opt out with `STACKS_DEV_AUTO_MIGRATE=0`.
 *
 * No reload-loop risk: `bun --watch` only watches the dev entry's module graph,
 * and this watcher writes migration files / mutates the DB file — neither of
 * which is imported by the dev server — so applying changes won't restart it.
 */
import { existsSync, watch } from 'node:fs'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'

let debounce: ReturnType<typeof setTimeout> | undefined
let running = false
let queued = false

export function startModelMigrationWatcher(): void {
  if (['0', 'false', 'off'].includes(String(process.env.STACKS_DEV_AUTO_MIGRATE).toLowerCase()))
    return

  const dirs = [path.userModelsPath(''), path.storagePath('framework/models')].filter((d) => {
    try {
      return existsSync(d)
    }
    catch {
      return false
    }
  })
  if (dirs.length === 0)
    return

  const schedule = (filename: string | null): void => {
    if (filename && !filename.endsWith('.ts'))
      return
    if (debounce)
      clearTimeout(debounce)
    debounce = setTimeout(() => void reconcile(), 400)
  }

  let watching = 0
  for (const dir of dirs) {
    try {
      watch(dir, { recursive: true }, (_event, filename) => schedule(filename))
      watching += 1
    }
    catch (err) {
      log.debug(`[dev] model watch failed for ${dir}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (watching > 0)
    log.debug('[dev] auto-migrate watcher active — model edits will sync the database')
}

async function reconcile(): Promise<void> {
  // Coalesce overlapping runs: if a change lands mid-run, do exactly one more.
  if (running) {
    queued = true
    return
  }
  running = true
  try {
    const { previewPendingMigrations, generateMigrations, runDatabaseMigration } = await import('@stacksjs/database')

    const ops = await previewPendingMigrations()
    if (ops.length === 0)
      return

    const destructive = ops.filter(o => o.destructive)
    if (destructive.length > 0) {
      log.warn(`[dev] ${destructive.length} destructive schema change${destructive.length === 1 ? '' : 's'} detected — not auto-applied. Run \`buddy migrate\` to review and apply.`)
      return
    }

    log.info(`[dev] Syncing database to models (${ops.length} change${ops.length === 1 ? '' : 's'})...`)
    const gen = await generateMigrations()
    if (gen.isErr) {
      log.error('[dev] auto-migrate: generation failed', gen.error)
      return
    }
    const run = await runDatabaseMigration()
    if (run.isErr) {
      log.error('[dev] auto-migrate: apply failed', run.error)
      return
    }
    log.success('[dev] Database is in sync with your models.')
  }
  catch (err) {
    log.warn(`[dev] auto-migrate skipped: ${err instanceof Error ? err.message : String(err)}`)
  }
  finally {
    running = false
    if (queued) {
      queued = false
      if (debounce)
        clearTimeout(debounce)
      debounce = setTimeout(() => void reconcile(), 400)
    }
  }
}
