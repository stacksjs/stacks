/**
 * Which stateful services this project runs on its own compute instance with
 * nothing backing them up.
 *
 * `managedServices: { postgres: true }` is one boolean, and it decides that the
 * only copy of the application's data lives on the same disk as the web
 * process. Nothing in the framework then takes a dump, a snapshot, or anything
 * offsite, and nothing says so - which is how it goes unnoticed
 * (stacksjs/stacks#2313).
 *
 * The asymmetry that makes it worth saying out loud: `buddy deploy` runs
 * `migrate` on every deploy. The framework is willing to run a schema change
 * against production data it has no way to restore.
 *
 * ## What this still warns about, now that dumps exist
 *
 * `buddy db:backup` takes a real dump, and the deploy takes one before every
 * `migrate` (see `database-backup.ts`). That closes the bad-migration hole. It
 * does NOT close this one: those dumps sit on the same disk as the database
 * they came from, so they survive a migration and do not survive losing the
 * box. Nothing in the framework copies them anywhere else.
 *
 * So this keeps warning, with narrower wording. The day something uploads a
 * dump offsite is the day this check should start consulting that config
 * instead of firing unconditionally.
 *
 * ## Why the dump itself did not have to wait for ts-cloud
 *
 * ts-cloud carries a full backup subsystem, but its logical database source
 * runs `pg_dumpall` through `runtime.exec()` against a **data container** and
 * throws `Data container <name> was not found` for anything else, while
 * `managedServices` installs the engine from pantry as a boot-time systemd
 * service. No container, so none of that machinery can reach a Stacks box.
 *
 * The thing that made a local implementation look unwise was the admin
 * connection: pantry's postgres grants `trust` on the unix socket but requires
 * md5 over TCP loopback where the `postgres` superuser has no password, and
 * ts-cloud encodes that rule in an unexported `pgAdminCommand()`. Dumping as
 * the **application's own user**, for the one database it owns, needs no
 * superuser and therefore no copy of that rule.
 */

/** A stateful service running on the instance with no backup path. */
export interface UnbackedService {
  /** The `managedServices` key, e.g. `postgres`. */
  name: string
  /** What is lost with the disk, in one clause. */
  holds: string
  /**
   * Does `buddy db:backup` know how to dump this engine?
   *
   * `false` for vitess: a `mysqldump` through a vtgate is not a restorable
   * backup of a sharded keyspace, so nothing is taken. The distinction has to
   * reach the message - telling a vitess app that the deploy dumps before every
   * migration would be false, and a warning that overstates its case is one
   * people learn to skip.
   */
  dumpable: boolean
}

/**
 * Services whose contents cannot be rebuilt from anything else on the box.
 *
 * Caches and derived indexes are deliberately absent: losing redis, memcached
 * or a meilisearch index costs a rebuild, not the data itself, and warning
 * about them would train people to ignore the warning that matters.
 */
const STATEFUL_SERVICES: Record<string, { holds: string, dumpable: boolean }> = {
  postgres: { holds: 'the application database', dumpable: true },
  mysql: { holds: 'the application database', dumpable: true },
  mariadb: { holds: 'the application database', dumpable: true },
  // Dumped by nothing: see `UnbackedService.dumpable`.
  vitess: { holds: 'the application database', dumpable: false },
}

/** Is this `managedServices` entry actually switched on? */
function isEnabled(value: unknown): boolean {
  if (value === true)
    return true

  if (!value || typeof value !== 'object')
    return false

  // An object is a configuration, so it is on unless it says otherwise.
  return (value as { enabled?: boolean }).enabled !== false
}

/**
 * Read the `managedServices` block of a ts-cloud config and return the stateful
 * services it provisions on the instance.
 *
 * Every one of them is unbacked today, so presence in this list is the whole
 * finding. When a `backups` surface exists, this is where it gets consulted.
 */
export function findUnbackedManagedServices(tsCloudConfig: unknown): UnbackedService[] {
  // Same as above: the parameter is `unknown` because callers pass whatever
  // ts-cloud config they loaded.
  const config = tsCloudConfig as { infrastructure?: { compute?: { managedServices?: unknown } } } | null | undefined
  const managed = config?.infrastructure?.compute?.managedServices

  if (!managed || typeof managed !== 'object')
    return []

  const out: UnbackedService[] = []

  for (const [name, { holds, dumpable }] of Object.entries(STATEFUL_SERVICES)) {
    if (isEnabled((managed as Record<string, unknown> | null | undefined)?.[name]))
      out.push({ name, holds, dumpable })
  }

  return out
}

/**
 * The sentence `doctor` and `deploy` both say. One wording, so the two cannot
 * drift into describing the situation differently.
 */
export function unbackedDataMessage(services: UnbackedService[]): string {
  const first = services[0]

  // Both callers check the list first, but a message helper that crashes on an
  // empty list is a warning path that can take down the command it was meant to
  // warn during.
  if (!first)
    return 'No unbacked managed data services.'

  const names = services.map(s => s.name).join(', ')
  const one = services.length === 1
  const subject = one ? `${names} is` : `${names} are`
  const holds = first.holds.charAt(0).toUpperCase() + first.holds.slice(1)

  const head = `${subject} provisioned on the compute instance. ${holds} shares a disk with the web process`

  // Two genuinely different situations, and saying the wrong one is how a
  // warning stops being read. An engine `buddy db:backup` cannot dump gets no
  // dump at all; the rest get one that is simply not offsite.
  if (services.every(s => s.dumpable)) {
    return `${head}, and nothing copies its data off the box. The dumps \`buddy deploy\` takes before each `
      + 'migration land on that same disk: they survive a bad migration, not the loss of the instance. '
      + 'Copy them somewhere else on a schedule, and check a restore works (`buddy db:restore`) before you need one.'
  }

  const undumpable = services.filter(s => !s.dumpable).map(s => s.name).join(', ')

  return `${head}, and nothing backs it up. \`buddy db:backup\` does not dump ${undumpable}: a logical dump `
    + 'taken through a vtgate does not restore a sharded keyspace, so pretending otherwise would be worse than '
    + 'saying nothing. Take a snapshot at the storage layer, and test restoring it (stacksjs/stacks#2313).'
}
