/**
 * The core packages' tests, split across CI jobs.
 *
 * CI ran every core package's suite one after another in one job: 15 of the
 * `test` job's 20 minutes, and the longest path to a deploy. Most of it is two
 * packages: auth (8 minutes; each scenario runs on SQLite, PostgreSQL and
 * MySQL) and buddy (2). So auth is split four ways by its own test files
 * (`bun test --shard`), buddy runs alone, and everything else is shared
 * between two jobs by measured time (`WEIGHTS`, seconds, CI 39209077336).
 *
 * What each package runs is unchanged from the single-job loop:
 *
 *  - one `bun test ./storage/framework/core/<pkg>/tests` per package (one
 *    over the whole tree segfaults bun; the leading `./` makes it a path);
 *  - router in two halves (`--shard=1/2`, `2/2`): past ~20 concurrent files
 *    its suite times out on the runner;
 *  - commerce and cms `src/tests`, and the testing package's component-dom
 *    fixture, from their own directory, where their bunfig preload applies.
 *
 * Usage: bun .github/scripts/core-tests.ts <shard>    run one shard
 *        bun .github/scripts/core-tests.ts --list     print the assignment
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

export interface TestUnit {
  /** The group name in the log, `core/<pkg>` as before. */
  label: string
  /** `bun test` arguments. */
  args: string[]
  /** Run from here (repo-relative); the repo root when absent. */
  cwd?: string
  /** For the split, seconds. */
  weight: number
}

/** Measured seconds per unit (CI 39209077336); anything unlisted counts as 2. */
export const WEIGHTS: Record<string, number> = {
  'core/database': 57, 'core/newsletter': 26, 'core/actions': 24, 'core/router (shard 1/2)': 18, 'core/orm': 17,
  'core/chat': 15, 'core/server': 11, 'core/security': 11, 'core/composables': 10, 'core/commerce': 8,
  'core/config': 8, 'core/router (shard 2/2)': 8, 'core/commerce (src/tests)': 7, 'core/queue': 7, 'core/scheduler': 6,
  'core/cache': 6, 'core/cli': 5, 'core/ai': 4, 'core/testing': 4, 'core/storage': 3, 'core/cloud': 3, 'core/cms': 2,
}

/** auth's test files run in this many jobs. */
export const AUTH_SHARDS = 4
/** The other packages (all but auth and buddy) share this many jobs. */
export const CORE_SHARDS = 2

const CORE = 'storage/framework/core'

/** Every unit the single-job loop ran, in its order. */
export function coreTestUnits(root: string): TestUnit[] {
  const units: TestUnit[] = []
  const unit = (label: string, args: string[], cwd?: string): TestUnit => ({ label, args, cwd, weight: WEIGHTS[label] ?? 2 })
  for (const pkg of readdirSync(join(root, CORE)).sort()) {
    if (!existsSync(join(root, CORE, pkg, 'tests'))) continue
    const dir = `./${CORE}/${pkg}/tests`
    if (pkg === 'router') {
      for (const shard of ['1/2', '2/2'])
        units.push(unit(`core/${pkg} (shard ${shard})`, [dir, `--shard=${shard}`]))
      continue
    }
    units.push(unit(`core/${pkg}`, [dir]))
  }
  units.push(unit('core/commerce (src/tests)', ['./src/tests'], `${CORE}/commerce`))
  units.push(unit('core/cms (src/tests)', ['./src/tests'], `${CORE}/cms`))
  units.push(unit('core/testing (component-dom fixture)', ['./tests'], `${CORE}/testing/fixtures/component-dom`))
  return units
}

/** The shard names CI's matrix lists, in order. */
export function shardNames(): string[] {
  return [
    ...Array.from({ length: AUTH_SHARDS }, (_, i) => `auth-${i + 1}`),
    'buddy',
    ...Array.from({ length: CORE_SHARDS }, (_, i) => `core-${i + 1}`),
  ]
}

/**
 * Which units each shard runs. auth by file across its shards, buddy alone,
 * the rest by weight onto the lightest core shard (heaviest first, ties to
 * the earlier shard, so the split is the same on every run).
 */
export function assignShards(units: readonly TestUnit[]): Record<string, TestUnit[]> {
  const shards: Record<string, TestUnit[]> = Object.fromEntries(shardNames().map(name => [name, []]))
  const core = shardNames().filter(name => name.startsWith('core-'))
  const load = Object.fromEntries(core.map(name => [name, 0])) as Record<string, number>
  for (const item of units) {
    if (item.label === 'core/auth') {
      for (let i = 1; i <= AUTH_SHARDS; i++)
        shards[`auth-${i}`]!.push({ ...item, label: `core/auth (shard ${i}/${AUTH_SHARDS})`, args: [...item.args, `--shard=${i}/${AUTH_SHARDS}`] })
    }
    else if (item.label === 'core/buddy') {
      shards.buddy!.push(item)
    }
  }
  const rest = units.filter(item => item.label !== 'core/auth' && item.label !== 'core/buddy')
  for (const item of [...rest].sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))) {
    const lightest = core.reduce((best, name) => (load[name]! < load[best]! ? name : best), core[0]!)
    shards[lightest]!.push(item)
    load[lightest]! += item.weight
  }
  // In the loop's own order within a shard, so the log reads the same.
  const order = new Map(units.map((item, index) => [item.label, index]))
  for (const name of core)
    shards[name]!.sort((a, b) => order.get(a.label)! - order.get(b.label)!)
  return shards
}

async function run(root: string, shard: string): Promise<void> {
  const shards = assignShards(coreTestUnits(root))
  const units = shards[shard]
  if (!units) throw new Error(`Unknown shard ${shard}: expected one of ${Object.keys(shards).join(', ')}`)
  const failed: string[] = []
  for (const item of units) {
    console.log(`::group::${item.label}`)
    const child = Bun.spawn([process.execPath, 'test', ...item.args], { cwd: join(root, item.cwd ?? ''), stdout: 'inherit', stderr: 'inherit', env: process.env })
    if (await child.exited !== 0) failed.push(item.label)
    console.log('::endgroup::')
  }
  if (failed.length) {
    console.log(`Failing core packages: ${failed.join(', ')}`)
    process.exit(1)
  }
}

if (import.meta.main) {
  const root = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
  const shard = process.argv[2]
  if (!shard || shard === '--list') {
    const shards = assignShards(coreTestUnits(root))
    for (const [name, units] of Object.entries(shards))
      console.log(`${name} (${units.reduce((sum, item) => sum + item.weight, 0)}s): ${units.map(item => item.label).join(', ')}`)
  }
  else {
    await run(root, shard)
  }
}
