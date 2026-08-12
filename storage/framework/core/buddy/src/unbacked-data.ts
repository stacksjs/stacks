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
 * ## Why this reports rather than fixes
 *
 * ts-cloud already carries a full backup subsystem - destinations, policies,
 * retention, recovery points, verification, restore planning - but its logical
 * database source runs `pg_dumpall` through `runtime.exec()` against a **data
 * container**, and throws `Data container <name> was not found` for anything
 * else. `managedServices` installs the engine from pantry as a boot-time
 * systemd service, so there is no container and none of that machinery can
 * reach it.
 *
 * Writing the dump here instead would mean hand-rolling the admin connection,
 * and that is the part which is not obvious: pantry's postgres grants `trust`
 * on the local unix socket but requires md5 over TCP loopback, where the
 * `postgres` superuser has no password - so an on-box admin command must omit
 * `-h` entirely and let the client find the socket. ts-cloud knows this and
 * encodes it in `pgAdminCommand()`, which is declared in its types but exported
 * from none of its entry points. A second copy of that rule in this repo would
 * be wrong the first time upstream changed it.
 *
 * So the dump belongs upstream, next to the code that installed the engine, and
 * this file's job is to make sure nobody finds out the way bughq did.
 */

/** A stateful service running on the instance with no backup path. */
export interface UnbackedService {
  /** The `managedServices` key, e.g. `postgres`. */
  name: string
  /** What is lost with the disk, in one clause. */
  holds: string
}

/**
 * Services whose contents cannot be rebuilt from anything else on the box.
 *
 * Caches and derived indexes are deliberately absent: losing redis, memcached
 * or a meilisearch index costs a rebuild, not the data itself, and warning
 * about them would train people to ignore the warning that matters.
 */
const STATEFUL_SERVICES: Record<string, string> = {
  postgres: 'the application database',
  mysql: 'the application database',
  mariadb: 'the application database',
  vitess: 'the application database',
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
  const managed = (tsCloudConfig as any)?.infrastructure?.compute?.managedServices

  if (!managed || typeof managed !== 'object')
    return []

  const out: UnbackedService[] = []

  for (const [name, holds] of Object.entries(STATEFUL_SERVICES)) {
    if (isEnabled(managed[name]))
      out.push({ name, holds })
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

  return `${subject} provisioned on the compute instance and nothing backs ${one ? 'it' : 'them'} up: `
    + `no dump, no snapshot, nothing offsite, and no restore path. ${holds} shares a disk with the web process, `
    + 'and `buddy deploy` runs `migrate` against it on every deploy. Until a backup surface lands (stacksjs/stacks#2313), '
    + 'take your own dump on a schedule and copy it off the box.'
}
