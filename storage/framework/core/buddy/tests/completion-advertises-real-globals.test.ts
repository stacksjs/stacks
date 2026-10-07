import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cli } from '@stacksjs/cli'
import { registerGlobalOptions } from '../src/global-options'

/**
 * The shell completions may only offer flags that exist.
 *
 * `buddy completion <shell>` writes one list of process-wide flags into each
 * of the three scripts, so that list and `registerGlobalOptions` have to
 * agree. They drifted twice in one day: `--dry-run` and then `--force` were
 * taken off the global set (stacksjs/stacks#2865, #2869) and both were left
 * behind in all three completion scripts.
 *
 * That is a worse failure than it looks. Before those changes the flag was
 * accepted and quietly ignored; afterwards it exits 2 as an unknown option on
 * every command that does not declare it. So tab-completion was actively
 * suggesting a flag that fails, which is the opposite of what a completion is
 * for, and nothing caught it because no test read these scripts.
 *
 * Only the direction that can lie is asserted. A global the scripts do not
 * mention yet is merely incomplete, and `--no-emoji` and `--no-cache` are both
 * in that state today; failing on those would force churn without protecting
 * anybody.
 */

const completionSource = join(import.meta.dir, '..', 'src', 'commands', 'completion.ts')

/**
 * Flags the scripts may name that are not ours to register.
 *
 * `help` and `version` are clapp built-ins, and `shell` is the `completion`
 * command's own argument, which its usage lines necessarily spell out.
 */
const NOT_GLOBAL = new Set(['help', 'version', 'shell'])

/** `--no-interaction` registers as `interaction`, `--dry-run` as `dryRun`. */
function optionKey(flag: string): string {
  return flag
    .replace(/^no-/, '')
    .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

function advertisedFlags(source: string): string[] {
  const found = new Set<string>()
  // `--verbose` in the bash and zsh scripts, `-l verbose` in the fish one.
  for (const match of source.matchAll(/--([a-z][a-z0-9-]*)/g))
    found.add(match[1])
  for (const match of source.matchAll(/-l\s+([a-z][a-z0-9-]*)/g))
    found.add(match[1])
  return [...found].sort()
}

describe('shell completions', () => {
  it('only advertise flags that are registered process-wide', () => {
    const buddy = cli('buddy')
    registerGlobalOptions(buddy)

    const global = (buddy as unknown as { globalCommand: { options: Array<{ names: string[] }> } }).globalCommand
    const registered = new Set(global.options.flatMap(option => option.names))

    const advertised = advertisedFlags(readFileSync(completionSource, 'utf8'))
    expect(advertised.length).toBeGreaterThan(3)

    const fictional = advertised.filter(flag => !NOT_GLOBAL.has(flag) && !registered.has(optionKey(flag)))

    expect(fictional).toEqual([])
  })

  it('no longer offer the two flags that moved to their commands', () => {
    // Named rather than left to the check above, because these two are the
    // regression: both were global, both were removed, and both outlived the
    // removal in these scripts.
    const flags = advertisedFlags(readFileSync(completionSource, 'utf8'))

    expect(flags).not.toContain('dry-run')
    expect(flags).not.toContain('force')
  })
})
