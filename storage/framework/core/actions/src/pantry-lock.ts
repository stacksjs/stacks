/**
 * Validate a regenerated `pantry.lock` before a release commits it
 * (stacksjs/stacks#2843).
 *
 * A release has to refresh this file. It records the whole workspace graph,
 * including a `^<version>` range for every `@stacksjs/*` package, so a version
 * bump that left it alone would commit a lock describing the previous release
 * and CI's "the lockfiles still describe this workspace" step would reject it.
 *
 * The problem is that the refresh runs wherever the release runs, and `pantry
 * install` is not reproducible across platforms today. On macOS it drops the
 * root `system` block, and with it the `bun.sh` toolchain pin that `Setup
 * Pantry` provisions before any job starts, and it has repeatedly walked
 * `craft-native` back to a version that does not satisfy the `>=` range the
 * workspace itself declares. Release commits are authored locally, so the
 * result is decided by whichever machine ran the release
 * (pantry-pm/pantry#231, #232, #233).
 *
 * That turned into a loop. The same record was corrected five times and
 * reverted by the next release each time, because nobody connects a red
 * `compile` to a release that happened hours earlier. A lock that violates its
 * own declared ranges is not a stale-but-valid pin: an install MUST re-resolve
 * it, which is exactly what CI reports.
 *
 * So this does not try to make `pantry install` reproducible, which is not
 * Stacks' file to fix. It makes the release refuse to commit a lock that is
 * self-inconsistent, turning a silently red main into a release that stops and
 * says why. Both checks are deliberately ones that cannot produce a false
 * positive: a range the lock itself records, and a block the previous lock
 * already had.
 */

/** The manifest fields whose ranges a lockfile is expected to honour. */
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

/**
 * Ranges that carry no comparable version.
 *
 * `workspace:*` and friends resolve to whatever is on disk, and `file:`,
 * `link:`, `git:`, `github:` and `npm:` aliases name a source rather than a
 * version. Checking them would report a violation against a lock that is
 * correct, and one false alarm in a release command is enough for the next
 * operator to stop believing it.
 */
const UNCOMPARABLE_RANGE = /^(?:workspace|file|link|git|github|npm|catalog):/

interface PantryLock {
  workspaces?: Record<string, Record<string, unknown>>
  packages?: Record<string, unknown>
}

/**
 * Split a `packages` key into its name and version.
 *
 * A scoped name contains an `@` of its own (`@stacksjs/actions@0.75.37`), so
 * the separator is the LAST one, and a leading `@` is never it.
 */
function splitPackageKey(key: string): { name: string, version: string } | null {
  const at = key.lastIndexOf('@')
  if (at <= 0)
    return null

  return { name: key.slice(0, at), version: key.slice(at + 1) }
}

/**
 * Every version the lock resolved for each package name.
 *
 * A name can legitimately appear more than once when two workspaces need
 * incompatible versions, so this maps to a list and the check below passes
 * when ANY of them matches. Requiring all of them would fail a correct lock
 * the moment a nested duplicate appeared.
 */
function resolvedVersions(packages: Record<string, unknown>): Map<string, string[]> {
  const resolved = new Map<string, string[]>()

  for (const key of Object.keys(packages)) {
    const parsed = splitPackageKey(key)
    if (!parsed)
      continue

    const versions = resolved.get(parsed.name)
    if (versions)
      versions.push(parsed.version)
    else
      resolved.set(parsed.name, [parsed.version])
  }

  return resolved
}

/**
 * The root `system` block pins the toolchain CI provisions before any job
 * runs, so losing it does not fail a job, it fails the setup that would have
 * run them. That is the 96-deletion signature a macOS install produces.
 *
 * Whether the block is REQUIRED is not knowable from the regenerated file
 * alone, so it is compared against the committed one. Inventing a requirement
 * would fail a repository that never had the block.
 */
function systemBlockProblems(root: Record<string, unknown> | undefined, baseline: string | null): string[] {
  if (!baseline)
    return []

  let baselineSystem: unknown
  try {
    baselineSystem = (JSON.parse(baseline) as PantryLock).workspaces?.['']?.system
  }
  catch {
    // An unparseable baseline is not a reason to block a release. The
    // regenerated file is the one being judged, and it parsed.
    return []
  }

  if (!baselineSystem || typeof baselineSystem !== 'object')
    return []

  const expected = baselineSystem as Record<string, unknown>
  const system = root?.system

  if (!system || typeof system !== 'object') {
    return [
      `the root "system" block was dropped (it pinned ${Object.keys(expected).join(', ')}), `
      + 'so CI would have no toolchain to provision',
    ]
  }

  const present = system as Record<string, unknown>

  return Object.keys(expected)
    .filter(pin => !(pin in present))
    .map(pin => `the root "system" block lost its "${pin}" pin`)
}

/**
 * Why this lockfile must not be committed, or an empty list when it is sound.
 *
 * Returns messages rather than throwing so the caller can report every problem
 * at once. An operator who fixes one pin, re-runs a long release and hits the
 * next one learns to distrust the check.
 */
export function pantryLockViolations(lock: string, baseline: string | null): string[] {
  let parsed: PantryLock
  try {
    parsed = JSON.parse(lock) as PantryLock
  }
  catch (error) {
    return [`it is not valid JSON (${error instanceof Error ? error.message : String(error)})`]
  }

  const problems: string[] = []
  const workspaces = parsed.workspaces ?? {}
  const resolved = resolvedVersions(parsed.packages ?? {})

  for (const [workspacePath, workspace] of Object.entries(workspaces)) {
    for (const field of DEPENDENCY_FIELDS) {
      const declared = workspace[field]
      if (!declared || typeof declared !== 'object')
        continue

      for (const [name, range] of Object.entries(declared as Record<string, unknown>)) {
        if (typeof range !== 'string' || UNCOMPARABLE_RANGE.test(range))
          continue

        // A name with no resolution is not this check's business: it means the
        // lock never pinned it, which an install reports far better than a
        // guess from here would.
        const versions = resolved.get(name)
        if (!versions)
          continue

        if (!versions.some(version => Bun.semver.satisfies(version, range))) {
          problems.push(
            `${name} is pinned at ${versions.join(', ')}, which does not satisfy "${range}" `
            + `declared by ${workspacePath || 'the workspace root'} (${field})`,
          )
        }
      }
    }
  }

  problems.push(...systemBlockProblems(workspaces[''], baseline))

  return problems
}
