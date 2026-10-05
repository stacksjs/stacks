import { describe, expect, it } from 'bun:test'
import { loadBuddyInventory } from '../src/commands/docs/buddy-commands'

/**
 * A `--no-x` option must not default to false.
 *
 * cac stores a negated flag under its positive key, so `--no-banner` sets
 * `banner`, and `{ default: false }` on it sets `banner: false` before the
 * user has typed anything. The feature is then off whether or not the flag is
 * given. It was off in five places: `dev:api` never started its type watcher,
 * `make:policy` never registered the policy in Gates.ts, `mail:preview` and
 * `mail:dev` never opened the browser, and `tinker` - which read a `noBanner`
 * key cac never sets - showed its banner even with `--no-banner`.
 * `doctor --no-fail` was the first instance (stacksjs/stacks#1957).
 */
describe('negated options', () => {
  const inventory = loadBuddyInventory()

  it('has negated options to check', () => {
    expect(inventory.commands.flatMap(command => command.options).filter(option => option.negated).length).toBeGreaterThan(5)
  })

  it('never default to false', () => {
    const offByDefault = inventory.commands.flatMap(command =>
      command.options
        .filter(option => option.negated && option.default === false)
        .map(option => `${command.name}: --no-${option.name} defaults to false, so ${option.name} is off even without the flag`),
    )

    expect(offByDefault.sort()).toEqual([])
  })
})
