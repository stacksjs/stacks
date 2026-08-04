import { describe, expect, it } from 'bun:test'
import { applyAliases } from '../src/cli'

/**
 * Regression: aliases in `app/Commands.ts` were applied with
 * `cli.alias(signature, alias)`, and there is no such method — aliases
 * belong to the command. Every alias anyone declared threw
 * `buddy.alias is not a function`, and the throw was caught by the
 * command loader and reported as "Failed to load command X", so the
 * symptom pointed at the command file rather than at the alias.
 */

function fakeCli(names: string[]) {
  const applied: Record<string, string[]> = {}
  const commands = names.map(name => ({
    name,
    alias(value: string) {
      applied[name] ??= []
      applied[name].push(value)
      return this
    },
  }))

  return { cli: { commands } as any, applied }
}

describe('applyAliases', () => {
  it('aliases the command the signature names', () => {
    const { cli, applied } = fakeCli(['preflight', 'inspire'])

    applyAliases(cli, 'preflight', ['check'])

    expect(applied.preflight).toEqual(['check'])
    expect(applied.inspire).toBeUndefined()
  })

  it('applies every alias given', () => {
    const { cli, applied } = fakeCli(['send-emails'])

    applyAliases(cli, 'send-emails', ['emails', 'mail'])

    expect(applied['send-emails']).toEqual(['emails', 'mail'])
  })

  it('matches a signature that carries arguments', () => {
    // `'send-emails <type>'` registers a command named `send-emails`.
    const { cli, applied } = fakeCli(['send-emails'])

    applyAliases(cli, 'send-emails <type>', ['mail'])

    expect(applied['send-emails']).toEqual(['mail'])
  })

  it('does not throw when no command matches', () => {
    const { cli } = fakeCli(['inspire'])

    // A registry entry whose file registers a different name is a mistake
    // worth a log line, not a reason to take the whole CLI down.
    expect(() => applyAliases(cli, 'missing', ['nope'])).not.toThrow()
  })

  it('does not throw when the CLI exposes no commands', () => {
    expect(() => applyAliases({} as any, 'preflight', ['check'])).not.toThrow()
  })
})
