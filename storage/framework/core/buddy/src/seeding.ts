/**
 * The database seeders, loaded with the runtime the code they run expects.
 *
 * A seeder is application code: it calls jobs, saves models and reads `db`, and
 * the auto-import declarations promise all of those as server globals. `buddy
 * seed` installed them before seeding and `migrate:fresh --seed` did not, so a
 * job using the bare `db` global worked from one command and failed with
 * `db is not defined` from the other (stacksjs/stacks#2952). Every command that
 * seeds goes through here, so none of them can skip the boot.
 */
export async function loadSeeders(): Promise<Pick<typeof import('@stacksjs/database'), 'seed' | 'runApplicationSeeders'>> {
  const { injectGlobalAutoImports } = await import('@stacksjs/server')
  await injectGlobalAutoImports()
  const { seed, runApplicationSeeders } = await import('@stacksjs/database')
  return { seed, runApplicationSeeders }
}
