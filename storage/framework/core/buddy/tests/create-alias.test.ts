import { expect, test } from 'bun:test'
import { cli } from '@stacksjs/cli'
import { create } from '../src/commands/create'

test('create alias resolves without including the new command argument signature', () => {
  const buddy = cli('buddy')
  create(buddy)
  const command = buddy.commands.find(command => command.name === 'new')
  expect(command?.aliasNames).toContain('create')
  expect(command?.aliasNames).not.toContain('create [name]')
})
