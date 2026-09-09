/**
 * The first migration `buddy setup` runs, and whether failing it fails setup.
 *
 * stacksjs/stacks#2560: this step used to downgrade every failure to
 * `Initial migration did not complete - you can run it later`, and setup went
 * on to print "Project is setup" and exit 0. A first install could therefore
 * complete, report success, and leave a database that never received its
 * schema, with the only signal a stack trace in output nobody reads on a green
 * run. Every check downstream then ran against that broken state and passed.
 *
 * The rule here is that reachability decides:
 *
 *   - the database answered  -> the migration is REQUIRED, and a failure is
 *     setup's failure
 *   - it did not answer      -> the migration is SKIPPED, said out loud, with
 *     the follow-up command named
 *
 * which is the "decide explicitly whether this is required or best-effort"
 * the issue asked for, rather than a step that looks required and behaves
 * optional. The decision is a pure function of injected dependencies so it can
 * be tested without a database, a subprocess, or a scaffolded project.
 */

/** What the initial migration did, as far as the rest of setup is concerned. */
export type MigrationOutcome = 'migrated' | 'skipped' | 'failed'

/** Whether the configured database can be reached, and why not when it cannot. */
export type Reachability = { ok: true } | { ok: false, reason: string }

export interface InitialMigrationDeps {
  /** The resolved application environment, lowercased. */
  appEnv: string
  /** Probe the configured database. */
  isReachable: () => Promise<Reachability>
  /** Run the migration. Resolves to a Result-like; rejects on a thrown error. */
  migrate: () => Promise<unknown>
  /** Whether a Result-like value is a failure (`resultFailed`). */
  failed: (result: unknown) => boolean
  log: {
    info: (message: string) => unknown
    warn: (message: string) => unknown
    success: (message: string) => unknown
    debug: (message: unknown) => unknown
  }
}

/**
 * Environments whose setup run may touch the database.
 *
 * Setup also runs on deploy and CI targets, where onboarding migrating the
 * database on its own would be a surprise.
 */
const MIGRATING_ENVIRONMENTS = ['local', 'development', 'dev', 'test']

export function migratesDuringSetup(appEnv: string): boolean {
  return MIGRATING_ENVIRONMENTS.includes(appEnv.toLowerCase())
}

/**
 * Run the initial migration and report what happened.
 *
 * Never exits or throws: the caller decides what an outcome costs.
 */
export async function runInitialMigration(deps: InitialMigrationDeps): Promise<MigrationOutcome> {
  if (!migratesDuringSetup(deps.appEnv)) {
    deps.log.info(`Skipping initial migration in the ${deps.appEnv} environment`)
    return 'skipped'
  }

  const reachable = await deps.isReachable()

  if (!reachable.ok) {
    deps.log.warn(`Skipping the initial migration: ${reachable.reason}`)
    deps.log.warn('Run `./buddy migrate` once the database is up - this project has no schema until you do.')
    return 'skipped'
  }

  deps.log.info('Running initial database migration...')

  try {
    // The migrate action is non-interactive (the confirmation guards live in
    // the `buddy migrate` command, not the action), so this is safe to run
    // unattended. The database answered a moment ago, so a failure here is a
    // failure of the migrations themselves, and setup does not paper over it.
    const result = await deps.migrate()

    if (deps.failed(result)) {
      deps.log.debug(result)
      return 'failed'
    }

    deps.log.success('Database is migrated')

    return 'migrated'
  }
  catch (error) {
    deps.log.debug(error)
    return 'failed'
  }
}
