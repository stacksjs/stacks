// Every flag `buddy new --help` lists does something.
//
// The command declared ten options its action never read (`--ui`,
// `--components`, `--web-components`, `--views`, `--functions`, `--api`,
// `--database`, `--cache`, `--email`, `--project`): leftovers of an interactive
// questionnaire that was never built. `buddy new --no-database` was accepted
// and scaffolded a database anyway, found scaffolding cursio.

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cli } from '@stacksjs/cli'
import { create } from '../src/commands/create'

const CREATE_COMMAND = join(import.meta.dir, '../src/commands/create.ts')
const RUN_COMMAND = join(import.meta.dir, '../../cli/src/run.ts')

/**
 * Options the action does not name itself but hands on, with the file that
 * reads them. The action spreads its options into `runCommand`.
 */
const READ_BY_A_CALLEE: Record<string, { file: string, read: string }> = {
  verbose: { file: RUN_COMMAND, read: 'options?.verbose' },
}

function declaredOptions(): string[] {
  const buddy = cli('buddy')
  create(buddy)
  const command = buddy.commands.find(command => command.name === 'new')
  if (!command)
    throw new Error('buddy new is not registered')

  // The long spelling, camel-cased the way the parser hands it to the action,
  // with the `no-` of a negated flag dropped.
  return command.options.map((option: { names: string[] }) => {
    const long = option.names.reduce((a, b) => (b.length > a.length ? b : a))
    return long.replace(/^no-/, '').replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
  })
}

describe('buddy new options', () => {
  const source = readFileSync(CREATE_COMMAND, 'utf8')
  const options = declaredOptions()

  test('the command declares options at all', () => {
    expect(options).toContain('minimal')
    expect(options).toContain('provision')
  })

  test('each one is read by the action or a function it calls', () => {
    const unread = options.filter((name) => {
      if (new RegExp(`\\boptions\\.${name}\\b`).test(source))
        return false

      const callee = READ_BY_A_CALLEE[name]
      return !callee || !readFileSync(callee.file, 'utf8').includes(callee.read)
    })

    expect(unread).toEqual([])
  })

  test('the hand-on list names only options that are declared', () => {
    expect(Object.keys(READ_BY_A_CALLEE).filter(name => !options.includes(name))).toEqual([])
  })
})
