/**
 * The driver capability matrix, published from its registry (stacksjs/stacks#2056).
 *
 * `capabilityRegistry` in `@stacksjs/config` is the allowlist: `checkCapability`
 * validates a configured driver name against it, and `assertCapabilityAvailable`
 * refuses an unsupported one. It carries the maturity of every driver, the
 * evidence behind that judgement, and what each cannot do.
 *
 * #2056 asks that capability pages expose maturity consistently, and there was
 * no capability page - the registry was reachable only by reading a TypeScript
 * file. Written by hand it would be a second set of claims with no owner, so
 * this generates it and `--check` fails CI when the two disagree. The same
 * shape as `docs:desktop-matrix` next door (#2059).
 *
 * The same page carries a second generated block: the desktop target's
 * interactive-content measurements (stacksjs/stacks#877), rendered from the
 * probe records in `@stacksjs/desktop-build`. One command and one CI check
 * cover both, so a record that changes without the page fails the same way a
 * registry entry does.
 *
 * Usage: `bun storage/framework/core/buddy/src/commands/docs/capabilities.ts [--check|--write]`
 */

import type { CapabilityCategory, CapabilityDriver } from '../../../../config/src/capabilities'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { capabilityRegistry } from '../../../../config/src/capabilities'
import { INTERACTIVE_BEGIN, INTERACTIVE_END, loadProbeRecords, renderInteractiveCapabilities } from '../../../../desktop/src/probe'
import { assertFrameworkRepo } from './framework-repo'

const root = new URL('../../../../../../../', import.meta.url).pathname
const page = join(root, 'docs/features/capabilities.md')

const BEGIN = '<!-- capability-matrix:begin -->'
const END = '<!-- capability-matrix:end -->'

/** Category order and heading, so the page reads the way the config does. */
const CATEGORIES: ReadonlyArray<[CapabilityCategory, string]> = [
  ['database', 'Database'],
  ['queue', 'Queue'],
  ['cache', 'Cache'],
  ['storage', 'Storage'],
  ['mail', 'Mail'],
  ['realtime', 'Realtime'],
  ['deploy', 'Deploy'],
]

const STATUS_NOTE: Record<CapabilityDriver['status'], string> = {
  supported: 'Contract evidence runs in CI.',
  partial: 'Works, with the gaps named below.',
  experimental: 'Usable, but without retained evidence.',
  unsupported: 'Cannot be selected; configuring it fails loudly.',
}

function row(driver: CapabilityDriver): string {
  const evidence = driver.testEvidence.length === 0
    ? 'none retained'
    : driver.testEvidence.map(path => `\`${path.split('/').pop()}\``).join('<br>')

  const live = driver.liveServiceContract
    ? `${driver.liveServiceContract.service} ${driver.liveServiceContract.version}`
    : '-'

  return `| \`${driver.name}\` | **${driver.status}** | ${driver.topology} | ${live} | ${evidence} |`
}

function section(category: CapabilityCategory, heading: string): string[] {
  const drivers = capabilityRegistry.filter(driver => driver.category === category)
  if (drivers.length === 0)
    return []

  const limitations = drivers.flatMap(driver =>
    driver.limitations.map(limitation => `- **\`${driver.name}\`** - ${limitation}`),
  )

  return [
    `### ${heading}`,
    '',
    '| Driver | Status | Topology | Live service | Evidence |',
    '|---|---|---|---|---|',
    ...drivers.map(row),
    '',
    ...(limitations.length > 0 ? ['**Limitations**', '', ...limitations, ''] : []),
  ]
}

/**
 * How current this page is, and why.
 *
 * #2056 asks capability pages to expose a last-verified revision. A git-derived
 * stamp was the obvious answer and the wrong one: the revision changes when the
 * registry changes, so every commit touching `capabilities.ts` would leave this
 * page stale and `docs:capabilities:check` red until a second commit
 * regenerated it. A freshness marker that breaks CI to stay fresh is worse than
 * none, and a hand-maintained date is the first thing to rot.
 *
 * What a reader is actually asking - "can I trust this today?" - has a stronger
 * answer than a date. The page is generated from the registry and CI fails when
 * the two disagree, so it is verified at every commit rather than at one.
 */
function verifiedLine(): string[] {
  return [
    '> **How current is this?** This table is generated from `capabilityRegistry`',
    '> in `@stacksjs/config`, and `docs:capabilities:check` fails CI when the two',
    '> disagree - so it is verified at every commit, not as of some date.',
    '>',
    '> The claims themselves are checked by `capabilities.test.ts`: every cited',
    '> file must exist, anything short of `supported` must give a reason, and a',
    '> `supported` driver on a remote topology must name the provider version it',
    '> was proven against.',
    '',
  ]
}

export function render(): string {
  const statuses = Object.entries(STATUS_NOTE).map(([status, note]) => `- **${status}** - ${note}`)

  return [
    BEGIN,
    '',
    '<!-- Generated by `buddy docs:capabilities` from `@stacksjs/config`\'s',
    '     `capabilityRegistry`. Edit that, not this. -->',
    '',
    ...statuses,
    '',
    ...verifiedLine(),
    ...CATEGORIES.flatMap(([category, heading]) => section(category, heading)),
    END,
  ].join('\n')
}

/** A generated block: its markers and how to render it. */
interface Block {
  begin: string
  end: string
  render: () => string
}

export const blocks: readonly Block[] = [
  { begin: BEGIN, end: END, render },
  { begin: INTERACTIVE_BEGIN, end: INTERACTIVE_END, render: () => renderInteractiveCapabilities(loadProbeRecords()) },
]

function current(block: Block): string | null {
  let contents: string
  try {
    contents = readFileSync(page, 'utf8')
  }
  catch {
    return null
  }

  const start = contents.indexOf(block.begin)
  const end = contents.indexOf(block.end)
  if (start === -1 || end === -1)
    return null

  return contents.slice(start, end + block.end.length)
}

function write(): boolean {
  const original = readFileSync(page, 'utf8')
  let contents = original

  for (const block of blocks) {
    const start = contents.indexOf(block.begin)
    const end = contents.indexOf(block.end)
    if (start === -1 || end === -1)
      throw new Error(`[docs:capabilities] ${page} is missing the ${block.begin} / ${block.end} markers`)
    contents = contents.slice(0, start) + block.render() + contents.slice(end + block.end.length)
  }

  if (contents === original)
    return false

  writeFileSync(page, contents)
  return true
}

export async function run(): Promise<void> {
  // This tool writes into the framework repository. See framework-repo.ts:
  // run from an application it would edit another project's files.
  assertFrameworkRepo(root, 'docs:capabilities')

  if (process.argv.includes('--write')) {
    console.log(write()
      ? '✓ rewrote the generated sections of docs/features/capabilities.md'
      : '✓ the capability matrix was already current')
    return
  }

  const stale = blocks.filter(block => current(block) !== block.render())
  if (stale.length === 0) {
    console.log(`✓ the capability matrix is current (${capabilityRegistry.length} drivers, ${loadProbeRecords().length} desktop probe records)`)
    return
  }

  for (const block of stale) {
    const source = block.begin === BEGIN ? 'capabilityRegistry' : 'the desktop probe records'
    console.error(current(block) === null
      ? `✗ docs/features/capabilities.md is missing its ${block.begin} section`
      : `✗ docs/features/capabilities.md no longer matches ${source}`)
  }
  console.error('\nRun `buddy docs:capabilities` to rewrite it from its sources.')

  if (process.argv.includes('--check'))
    process.exit(1)
}

if (import.meta.main)
  await run()
