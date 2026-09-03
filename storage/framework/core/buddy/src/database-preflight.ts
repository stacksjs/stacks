/**
 * Ask before creating a database that does not exist yet, the way Laravel does.
 *
 * This runs in the buddy PARENT process, never in the action subprocess.
 * `runAction` spawns the migrate action with `stdin: 'inherit'`, so a prompt
 * raised down there competes with the parent for the same stdin and can hang
 * with no visible question. The parent is also the only place that still has
 * the interactive terminal at all.
 *
 * The decision is handed down to the child through `STACKS_CREATE_DATABASE`,
 * which `@stacksjs/database`'s bootstrap reads. A flag would not survive the
 * boundary as cleanly, and an env var matches the existing
 * `STACKS_MIGRATE_FROM_DB` / `STACKS_MIGRATE_NO_RENAME` pattern.
 */

import process from 'node:process'
import { confirmOrNull, log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

export interface DatabasePreflightOptions {
  /** `--create-database`: create without asking. Safe for CI. */
  createDatabase?: boolean
  /** Label for the cancellation message, e.g. 'migrate' or 'seed'. */
  command?: string
}

/**
 * Whether we may raise a blocking question right now.
 *
 * Computed per call rather than read from `@stacksjs/env`'s `isCI` / `hasTTY`,
 * which are module-level constants frozen at first import: anything that sets
 * `CI` after the env package loads (a wrapper script, a test harness, a config
 * file evaluated during CLI boot) would otherwise get no protection at all.
 *
 * Both stdin and stdout are required. stdout alone is not enough: `buddy
 * migrate < /dev/null` keeps a terminal on stdout while stdin is at EOF.
 */
export function canPromptInteractively(): boolean {
  if (process.env.CI || process.env.CONTINUOUS_INTEGRATION || process.env.BUILD_NUMBER || process.env.RUN_ID)
    return false

  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

/**
 * Resolve the standing policy, if the user set one.
 * `always` and `never` skip the question entirely in both directions.
 */
export function resolveCreatePolicy(): 'always' | 'never' | 'prompt' {
  const value = String(process.env.DB_CREATE_DATABASE || '').toLowerCase()
  if (value === 'always' || value === 'true' || value === '1')
    return 'always'
  if (value === 'never' || value === 'false' || value === '0')
    return 'never'
  return 'prompt'
}

/** Hand the answer to the action subprocess. */
function decide(create: boolean): void {
  process.env.STACKS_CREATE_DATABASE = create ? '1' : '0'
}

/** Sentinel for "nobody answered", kept distinct from a real no. */
const UNANSWERED = Symbol('unanswered')

/**
 * Ask, but never wait forever.
 *
 * A TTY is not proof that a human is watching it. `docker run -t`, process
 * supervisors like overmind and foreman, IDE run configurations, and CI
 * runners that allocate a pty without setting any CI variable all present a
 * terminal that nobody will ever type into, and none of them can be detected
 * from inside the process. Those are the cases the isCI and isTTY heuristics
 * provably cannot catch, so the only remaining protection is a bound.
 *
 * Timing out means NOT creating anything. The interactive default is yes,
 * because a human who ran `buddy migrate` on a missing database almost
 * certainly wants it, but silence is not consent to provision infrastructure.
 */
async function confirmWithTimeout(message: string, timeoutMs: number): Promise<boolean | typeof UNANSWERED> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      // confirmOrNull, not confirm: `confirm` maps EOF to the default, and the
      // default here is YES. An unattended process whose stdin ends would then
      // silently answer yes to a question nobody saw, and provision a database.
      confirmOrNull({ message, initial: true }).then(v => v === null ? UNANSWERED : v),
      new Promise<typeof UNANSWERED>((resolve) => {
        timer = setTimeout(() => resolve(UNANSWERED), timeoutMs)
      }),
    ])
  }
  finally {
    if (timer)
      clearTimeout(timer)
  }
}

/**
 * Offer to create the target database when it is missing.
 *
 * Returns normally when the command may proceed. Exits the process when the
 * user declines or when there is no safe way to continue. Never creates
 * anything itself: it only records the decision, and the bootstrap in
 * `@stacksjs/database` performs the create at the usual point.
 */
export async function preflightDatabase(options: DatabasePreflightOptions = {}): Promise<void> {
  const commandName = options.command || 'migrate'

  const {
    canCreateDatabases,
    describeTarget,
    manualCreateHint,
    probeTargetDatabase,
    resolveConnectionTarget,
  } = await import('@stacksjs/database')

  const target = resolveConnectionTarget()

  // SQLite creates its file on open; DynamoDB has no SQL catalog. Nothing to ask.
  if (!target)
    return

  const probe = await probeTargetDatabase(target)

  // Either it is there, or it failed for a reason creating a database cannot
  // fix (server down, bad credentials). Let the bootstrap report those: it
  // already produces one actionable line per cause.
  if (probe.ok || probe.kind !== 'missing-database')
    return

  const where = describeTarget(target)
  const standing = resolveCreatePolicy()

  if (standing === 'never') {
    // Fall through to the bootstrap, which prints the same refusal and exits.
    decide(false)
    return
  }

  if (options.createDatabase || standing === 'always') {
    decide(true)
    return
  }

  if (!canPromptInteractively()) {
    log.syncError(`The database "${target.database}" does not exist on ${where}.`)
    log.syncError('Refusing to create it in a non-interactive shell.')
    log.syncError(`  Create it ahead of time, re-run with --create-database, or set DB_CREATE_DATABASE=always.`)
    log.syncError(`  ${manualCreateHint(target)}`)
    process.exit(ExitCode.FatalError)
  }

  // Never ask a question whose "yes" is guaranteed to fail. `null` means we
  // could not tell, in which case we still ask and let the attempt speak.
  const permitted = await canCreateDatabases(target)
  if (permitted === false) {
    log.syncError(`The database "${target.database}" does not exist on ${where}.`)
    log.syncError(`The user "${target.username}" is not allowed to create databases, so I cannot create it for you.`)
    log.syncError(`  Grant it with:  ALTER ROLE "${target.username}" CREATEDB;`)
    log.syncError(`  Or create the database yourself with:  ${manualCreateHint(target)}`)
    process.exit(ExitCode.FatalError)
  }

  log.warn(`The database "${target.database}" does not exist on ${where}.`)
  // Flush buffered async logs so the warning paints ABOVE the question rather
  // than landing underneath it, which makes the prompt look context-free.
  await log.flush()

  const timeoutMs = Number(process.env.DB_CREATE_DATABASE_TIMEOUT_MS || 120_000)
  const answer = await confirmWithTimeout('Would you like to create it?', timeoutMs)

  if (answer === UNANSWERED) {
    log.syncError(`No answer after ${Math.round(timeoutMs / 1000)}s, so nothing was created.`)
    log.syncError(`  Re-run with --create-database, or set DB_CREATE_DATABASE=always, to skip this question.`)
    log.syncError(`  ${manualCreateHint(target)}`)
    process.exit(ExitCode.FatalError)
  }

  const create = answer

  if (!create) {
    decide(false)
    log.info('Nothing was changed. Create it yourself with:')
    log.info(`  ${manualCreateHint(target)}`)
    log.info(`Then re-run \`buddy ${commandName}\`, or re-run with --create-database to skip this question.`)
    await log.flush()
    process.exit(ExitCode.Success)
  }

  decide(true)
}
