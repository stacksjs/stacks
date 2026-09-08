import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadBuddyInventory } from '../src/commands/docs/buddy-commands'

/**
 * Every `make:*` the docs name is a command you can actually run.
 *
 * `buddy make` dispatches its subcommands from one switch, and each maker also
 * gets a `make:<thing>` command of its own. Two never got the second half:
 * `make:middleware` and `make:page` existed only as `buddy make middleware Foo`,
 * while `AGENTS.md` listed both in the colon form every other maker uses. So the
 * documented spelling was the one that answered "Command not found."
 *
 * Checked against the docs rather than against the switch, because the switch is
 * where they already worked - the docs are the promise that was broken.
 */

const root = join(import.meta.dir, '..', '..', '..', '..', '..')

describe('make: commands', () => {
  const registered = new Set(loadBuddyInventory().commands.map(command => command.name))

  it('has makers to check', () => {
    expect([...registered].filter(name => name.startsWith('make:')).length).toBeGreaterThan(15)
  })

  /**
   * `AGENTS.md`, not `CLAUDE.md`. The latter is generated from
   * `storage/framework/defaults/ai/` by `buddy setup:ai` and is gitignored, so
   * reading it passed on a developer machine and failed in CI with an empty
   * set - which is exactly the shape this file is meant to catch, and it caught
   * itself.
   */
  it('include every one the project docs name', () => {
    const docs = readFileSync(join(root, 'AGENTS.md'), 'utf8')
    const named = new Set([...docs.matchAll(/`?(make:[a-z-]+)`?/g)].map(match => match[1]))

    expect(named.size).toBeGreaterThan(10)

    const missing = [...named].filter(name => !registered.has(name))
    expect(missing.sort()).toEqual([])
  })
})
