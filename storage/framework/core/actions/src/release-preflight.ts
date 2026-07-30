/**
 * Local pre-flight for `buddy release`.
 *
 * `.github/workflows/release.yml` gates publishing on the pinned checks, but it
 * only gets to run after a tag has been pushed. By then the failure costs a
 * re-tag. Running the same checks here means a stale artifact stops the release
 * before the version is bumped, the commit is made, or the tag exists.
 *
 * The check list is DERIVED from package.json rather than written out again.
 * There are already copies in ci.yml and release.yml, and a third hand-kept
 * list would be the same drift problem this whole gate exists to prevent: add a
 * `protocol:*:check` script, forget one list, and the gate silently stops
 * covering it. Anything matching `protocol:*:check` or `docs:*:check` is picked
 * up automatically.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Set to '1' or 'true' to skip the pre-flight. Mirrors the workflow's RELEASE_GATE_BYPASS variable. */
export const BYPASS_ENV = 'RELEASE_GATE_BYPASS'

export interface PreflightResult {
  ran: string[]
  failures: Array<{ script: string, output: string }>
  bypassed: boolean
}

/**
 * The pinned suite: every `protocol:…:check` and `docs:…:check` script.
 *
 * Deliberately narrow. `types:check`, `format:check` and `deps:lockfile:check`
 * also end in `:check` but are not generated-artifact freshness checks, they
 * are slow, and two of them have no generator to fix them with.
 */
export function pinnedCheckScripts(scripts: Record<string, unknown>): string[] {
  return Object.keys(scripts)
    // The optional middle segment matters: `protocol:check` has none, while
    // `protocol:drivers:check` and `docs:buddy:check` do. Requiring one silently
    // dropped `protocol:check` from the suite.
    .filter(name => /^(?:protocol|docs):(?:[\w:-]+:)?check$/.test(name))
    .sort()
}

export function readPinnedChecks(cwd: string): string[] {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as { scripts?: Record<string, unknown> }
    return pinnedCheckScripts(pkg.scripts ?? {})
  }
  catch {
    // A release from a tree with no readable package.json has bigger problems,
    // and failing the pre-flight open here would be worse than useless.
    return []
  }
}

function isBypassed(env: Record<string, string | undefined>): boolean {
  const value = env[BYPASS_ENV]
  return value === '1' || value === 'true'
}

/**
 * Run every pinned check, concurrently, and report all failures.
 *
 * Concurrent because each one pays roughly five seconds of buddy CLI startup;
 * sequentially the suite is about a minute, in parallel it is closer to the
 * slowest single check. They are independent read-only checks, so there is
 * nothing to serialise.
 *
 * Reports ALL failures rather than stopping at the first: a release blocked by
 * two stale artifacts should cost one round trip, not two.
 */
export async function runPinnedChecks(options: {
  cwd: string
  env?: Record<string, string | undefined>
  scripts?: string[]
} = { cwd: process.cwd() }): Promise<PreflightResult> {
  const env = options.env ?? process.env
  if (isBypassed(env))
    return { ran: [], failures: [], bypassed: true }

  const scripts = options.scripts ?? readPinnedChecks(options.cwd)
  if (scripts.length === 0)
    return { ran: [], failures: [], bypassed: false }

  const results = await Promise.all(scripts.map(async (script) => {
    const proc = Bun.spawn(['bun', 'run', script], {
      cwd: options.cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { script, exitCode, output: `${stdout}${stderr}`.trim() }
  }))

  return {
    ran: scripts,
    failures: results.filter(r => r.exitCode !== 0).map(r => ({ script: r.script, output: r.output })),
    bypassed: false,
  }
}

/** The message shown when the pre-flight blocks a release. */
export function formatPreflightFailure(failures: PreflightResult['failures']): string {
  const lines = [
    `Release blocked: ${failures.length} pinned check${failures.length === 1 ? '' : 's'} failed.`,
    '',
  ]

  for (const failure of failures) {
    lines.push(`  ${failure.script}`)
    // The check's own output already names the stale artifact and the generator
    // that refreshes it, so quote it rather than paraphrasing. Strip the wrapper
    // noise first: the env plugin's banner, `bun run`'s `$ ./buddy …` echo, and
    // its trailing `error: script … exited` line all crowd out the one or two
    // lines that actually say what is wrong.
    const informative = failure.output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line
        && !line.startsWith('[env]')
        && !line.startsWith('$ ')
        && !line.startsWith('error: script'))

    for (const line of informative.slice(0, 4))
      lines.push(`    ${line}`)
    lines.push('')
  }

  lines.push('Nothing was bumped, committed, or tagged.')
  lines.push(`Regenerate the affected artifacts and retry, or set ${BYPASS_ENV}=1 to release anyway.`)

  return lines.join('\n')
}
