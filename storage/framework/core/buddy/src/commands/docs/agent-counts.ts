/**
 * The counts that agent-facing docs state (stacksjs/stacks#2056).
 *
 * `AGENTS.md` and the skills quote numbers - how many models ship, how many
 * components, how many names are auto-imported. Every agent working in this
 * repo reads them, so a wrong number is a false statement acted on rather than
 * a cosmetic error, and every one of them had drifted:
 *
 *   default actions  80+ -> 621    components  150+/250+ -> 399
 *   built-in models  50+ ->  97    composables      90+  -> 153
 *   migrations       96+ -> 220    skills          100+  -> 115
 *
 * One was wrong rather than merely stale: `AGENTS.md` promised "200+
 * composables" available with no import, where the browser manifest declares
 * 83 names. An agent trusting that reaches for a global that does not exist and
 * reads the failure as a bug in the framework.
 *
 * `N+` is the mechanism. It stays technically true while the real number grows
 * past any use, so nothing ever forces a correction - "50+ commands" was true
 * at 315 and useless. Exact numbers rot visibly, which is the point, and this
 * is what makes rotting cheap to fix: `--write` measures the tree and rewrites
 * the sentences.
 *
 * Not every count belongs here. The buddy command reference is generated from
 * the runtime registry and already checked, so `AGENTS.md` and `stacks-buddy`
 * POINT at it rather than restating it - a restatement is a second source of
 * truth with no owner. Pin what moves rarely; defer to the generated artifact
 * when it moves often.
 *
 * Usage: `bun storage/framework/core/buddy/src/commands/docs/agent-counts.ts [--check|--write]`
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { assertFrameworkRepo } from './framework-repo'

const root = new URL('../../../../../../../', import.meta.url).pathname

function abs(relative: string): string {
  return join(root, relative)
}

/** Every file with `extension` under `dir`, ignoring barrels. */
function countFiles(dir: string, extension: string): number {
  let entries: string[]
  try {
    entries = readdirSync(abs(dir))
  }
  catch {
    return 0
  }

  return entries.reduce((total, entry) => {
    const full = join(abs(dir), entry)
    if (statSync(full).isDirectory())
      return total + countFiles(join(dir, entry), extension)
    if (!entry.endsWith(extension) || entry === 'index.ts')
      return total
    return total + 1
  }, 0)
}

function countDirs(dir: string): number {
  return readdirSync(abs(dir)).filter(entry => statSync(join(abs(dir), entry)).isDirectory()).length
}

const SKILLS = 'storage/framework/defaults/ai/skills'
const AGENTS = 'AGENTS.md'

/**
 * A claim: what it counts, and every sentence that states it.
 *
 * A count with more than one site is the interesting case. `stacks-dashboard`
 * said 250+ components while `AGENTS.md` said 150+ for the same directory -
 * two documents disagreeing about one number, which is how you can tell
 * nothing was checking either. Listing the sites together makes that
 * impossible to reintroduce.
 */
interface Claim {
  what: string
  measure: () => number
  sites: Array<{ file: string, pattern: RegExp }>
}

const CLAIMS: Claim[] = [
  {
    what: 'built-in models',
    measure: () => countFiles('storage/framework/defaults/app/Models', '.ts'),
    sites: [
      { file: AGENTS, pattern: /(\d+) built-in models you can use or override/ },
      { file: AGENTS, pattern: /All (\d+) models \(`User`/ },
      { file: `${SKILLS}/stacks-orm/SKILL.md`, pattern: /(\d+) models/ },
      { file: `${SKILLS}/stacks-auto-imports/SKILL.md`, pattern: /\((\d+) models\)/ },
    ],
  },
  {
    what: 'commerce models',
    measure: () => countFiles('storage/framework/defaults/app/Models/commerce', '.ts'),
    sites: [
      { file: `${SKILLS}/stacks-commerce/SKILL.md`, pattern: /and (\d+) models/ },
      { file: `${SKILLS}/stacks-types/SKILL.md`, pattern: /Commerce \((\d+) models\)/ },
    ],
  },
  {
    what: 'components',
    measure: () => countFiles('storage/framework/defaults/resources/components', '.stx'),
    sites: [
      { file: AGENTS, pattern: /widgets \((\d+) components\)/ },
      { file: `${SKILLS}/stacks-dashboard/SKILL.md`, pattern: /(\d+) built-in dashboard components/ },
    ],
  },
  {
    what: 'default actions',
    measure: () => readFileSync(abs('storage/framework/auto-imports/actions.ts'), 'utf-8')
      .split('\n').filter(line => /^\s+'/.test(line)).length,
    sites: [{ file: AGENTS, pattern: /(\d+) default actions/ }],
  },
  {
    what: 'migrations',
    measure: () => countFiles('database/migrations', '.sql'),
    sites: [{ file: AGENTS, pattern: /(\d+) migrations ship for/ }],
  },
  {
    what: 'browser auto-imports',
    measure: () => Object.keys(JSON.parse(
      readFileSync(abs('storage/framework/browser-auto-imports.json'), 'utf-8'),
    ).globals).length,
    sites: [{ file: AGENTS, pattern: /There are \*\*(\d+)\*\* of/ }],
  },
  {
    what: 'composables',
    measure: () => new Set(
      readFileSync(abs('storage/framework/core/composables/src/index.ts'), 'utf-8')
        .match(/\buse[A-Z][A-Za-z0-9]*/g) ?? [],
    ).size,
    sites: [{ file: `${SKILLS}/stacks-composables/SKILL.md`, pattern: /(\d+) composables/ }],
  },
  {
    what: 'skills',
    measure: () => countDirs(SKILLS),
    sites: [{ file: `${SKILLS}/stacks-writing-for-agents/SKILL.md`, pattern: /ships (\d+) skills/ }],
  },
]

interface Drift {
  what: string
  file: string
  stated: number | null
  actual: number
}

function inspect(): { drift: Drift[], checked: number } {
  const drift: Drift[] = []
  let checked = 0

  for (const claim of CLAIMS) {
    const actual = claim.measure()

    for (const site of claim.sites) {
      checked++
      const match = readFileSync(abs(site.file), 'utf-8').match(site.pattern)
      // A missing claim is drift too: someone reworded the sentence, and the
      // number left with it. Silence would be the wrong answer.
      const stated = match ? Number(match[1]) : null
      if (stated !== actual)
        drift.push({ what: claim.what, file: site.file, stated, actual })
    }
  }

  return { drift, checked }
}

function write(): number {
  let rewritten = 0

  for (const claim of CLAIMS) {
    const actual = claim.measure()

    for (const site of claim.sites) {
      const source = readFileSync(abs(site.file), 'utf-8')
      const match = source.match(site.pattern)
      if (!match || Number(match[1]) === actual)
        continue

      // Replace only the digits inside the matched sentence, so surrounding
      // wording survives untouched.
      const updated = match[0].replace(String(match[1]), String(actual))
      writeFileSync(abs(site.file), source.replace(match[0], updated), 'utf-8')
      rewritten++
    }
  }

  return rewritten
}

export async function run(): Promise<void> {
  // This tool writes into the framework repository. See framework-repo.ts:
  // run from an application it would edit another project's files.
  assertFrameworkRepo(root, 'docs:agent-counts')

  if (process.argv.includes('--write')) {
    const rewritten = write()
    console.log(rewritten === 0
      ? '✓ agent-facing counts were already current'
      : `✓ updated ${rewritten} count(s); run \`buddy setup:ai\` to refresh the installed copies`)
    return
  }

  const { drift, checked } = inspect()

  if (drift.length === 0) {
    console.log(`✓ agent-facing counts are current (${checked} checked)`)
    return
  }

  console.error(`✗ ${drift.length} of ${checked} agent-facing count(s) no longer match the tree:`)
  for (const entry of drift) {
    console.error(entry.stated === null
      ? `  ${entry.file}: the ${entry.what} claim is gone - reword the check, or restore the sentence`
      : `  ${entry.file}: says ${entry.stated} ${entry.what}, tree has ${entry.actual}`)
  }
  console.error('\nRun `buddy docs:agent-counts` to rewrite them from the tree.')

  if (process.argv.includes('--check'))
    process.exit(1)
}

if (import.meta.main)
  await run()
