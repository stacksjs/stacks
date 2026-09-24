import { describe, expect, it } from 'bun:test'
import { loadBuddyInventory } from '../src/commands/docs/buddy-commands'

/**
 * A command must not give one short flag to two options.
 *
 * `generate` declared `-c` for both `--custom-data` and `--component-meta`, and
 * `-p` for both `--pantry` and `--project`; `env:get` declared `-p` for both
 * `--pretty` and `--project`. `--help` listed every pair as if both worked, but
 * the parser keeps only the last registration, so `buddy generate -p` targeted
 * a project instead of writing the pantry config, and `buddy env:get -p` never
 * pretty-printed anything. Nothing errors: the losing option is simply
 * unreachable by its short flag, and which one loses is an accident of
 * declaration order.
 */
describe('short flags', () => {
  const inventory = loadBuddyInventory()

  it('has an inventory to check', () => {
    expect(inventory.commands.length).toBeGreaterThan(100)
  })

  it('never gives one short flag to two options of the same command', () => {
    const collisions = inventory.commands.flatMap((command) => {
      const owners = new Map<string, string[]>()
      for (const option of command.options) {
        for (const flag of option.flags.filter(flag => flag.length === 1))
          owners.set(flag, [...(owners.get(flag) ?? []), `--${option.flags.find(f => f.length > 1) ?? option.name}`])
      }

      return [...owners.entries()]
        .filter(([, options]) => options.length > 1)
        .map(([flag, options]) => `${command.name}: -${flag} is declared by ${options.join(' and ')}`)
    })

    expect(collisions.sort()).toEqual([])
  })
})
