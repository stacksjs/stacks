import { describe, expect, it } from 'bun:test'
import { loadBuddyInventory } from '../src/commands/docs/buddy-commands'

/**
 * An alias must not spell a command that exists.
 *
 * `cloud:remove` - which tears down the whole cloud - carried `cloud:destroy` as
 * an alias. When `cloud:destroy <server>` was added for a single box, the alias
 * won: `buddy cloud:destroy some-box --dry-run` printed the whole-cloud teardown
 * prompt instead, and nothing anywhere said the two names had collided. That is
 * the worst version of this bug, since the name that wins is the more
 * destructive one, but the shape is general: whichever registration happens to
 * come first silently takes the name.
 */
describe('command names and aliases', () => {
  const inventory = loadBuddyInventory()

  it('has an inventory to check', () => {
    expect(inventory.commands.length).toBeGreaterThan(100)
  })

  it('never aliases a name that is already a command', () => {
    const names = new Set(inventory.commands.map(command => command.name))

    const collisions = inventory.commands.flatMap(command =>
      (command.aliases ?? [])
        .filter(alias => names.has(alias))
        .map(alias => `${command.name} aliases '${alias}', which is its own command`),
    )

    expect(collisions.sort()).toEqual([])
  })

  it('never gives two commands the same alias', () => {
    const owners = new Map<string, string[]>()
    for (const command of inventory.commands) {
      for (const alias of command.aliases ?? [])
        owners.set(alias, [...(owners.get(alias) ?? []), command.name])
    }

    const shared = [...owners.entries()]
      .filter(([, commands]) => commands.length > 1)
      .map(([alias, commands]) => `'${alias}' is claimed by ${commands.join(' and ')}`)

    expect(shared.sort()).toEqual([])
  })

  it('never registers one name twice', () => {
    const seen = new Map<string, number>()
    for (const command of inventory.commands)
      seen.set(command.name, (seen.get(command.name) ?? 0) + 1)

    expect([...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name)).toEqual([])
  })
})
