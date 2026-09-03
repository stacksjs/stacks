/**
 * Advice that names a `buddy` command names one that exists.
 *
 * `phone:search` ended with "To claim a number, use `buddy phone:claim
 * <number>`" and there is no `phone:claim` - the namespace registers `phone`,
 * `phone:status`, `phone:numbers`, `phone:search` and `phone:setup`. The
 * message was written ahead of a feature that never landed, and nothing
 * noticed because a string is a string (stacksjs/stacks#2056).
 *
 * The registry is the authority here, via the generated command reference that
 * `docs:buddy:check` already keeps current. Aliases count as real names, since
 * `.alias('prod:components')` is a command a reader can type.
 */
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../../../../', import.meta.url).pathname

/**
 * Every command the runtime registers, from the generated reference.
 *
 * `docs:buddy:check` already keeps that file current against the registry, so
 * it is the authority - and unlike scanning `.command()` calls it includes the
 * ones registered dynamically (`app/Commands/*`, `<feature>:install`), which a
 * source scan reports as missing when they are real.
 */
function registeredCommands(): Set<string> {
  const reference = readFileSync(join(root, 'docs/guide/buddy/commands.md'), 'utf-8')
  const names = new Set<string>()

  for (const match of reference.matchAll(/`([a-z][a-z0-9:_-]*)`/g))
    names.add(match[1]!)

  return names
}

function commandsInSource(dir: string): Set<string> {
  const names = new Set<string>()

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      for (const name of commandsInSource(full))
        names.add(name)
      continue
    }
    if (!entry.endsWith('.ts'))
      continue

    const source = readFileSync(full, 'utf-8')
    // `.command('x <arg>')` and `.alias('y [arg]')` both name a command; the
    // argument spec is not part of the name.
    for (const match of source.matchAll(/\.(?:command|alias)\(\s*'([a-z][a-z0-9:_-]*)/g))
      names.add(match[1]!)
  }

  return names
}

/** Advice strings: a backticked `buddy <name>` inside framework source. */
function advisedNames(dir: string, found = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (!['dist', 'node_modules', 'bin', 'tests'].includes(entry))
        advisedNames(full, found)
      continue
    }
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts'))
      continue

    /*
     * Only what a user can be shown. A stale name in a comment misleads the
     * next reader of the file; a stale name in a message strands whoever hit
     * the error, which is the failure worth failing a build over.
     */
    for (const line of readFileSync(full, 'utf-8').split('\n')) {
      const code = line.trimStart()
      if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*'))
        continue
      for (const match of line.matchAll(/`(?:\.\/)?buddy ([a-z][a-z0-9:_-]*[a-z0-9])`/g))
        found.set(match[1]!, full.replace(root, ''))
    }
  }

  return found
}

describe('command advice', () => {
  it('never names a command that is not registered', () => {
    const registered = new Set([
      ...registeredCommands(),
      ...commandsInSource(join(root, 'storage/framework/core/buddy/src/commands')),
    ])
    // `help` comes from the CLI framework rather than a `.command()` call.
    const builtins = new Set(['help'])

    const unknown = [...advisedNames(join(root, 'storage/framework/core'))]
      .filter(([name]) => !registered.has(name) && !builtins.has(name))
      .map(([name, file]) => `buddy ${name} (${file})`)

    expect(unknown.sort()).toEqual([])
  })
})
