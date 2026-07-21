import { describe, expect, it } from 'bun:test'
import { cli } from '@stacksjs/cli'
import { commandInventoryEntry, list } from '../src/commands/list'

describe('buddy list JSON inventory', () => {
  it('registers the direct JSON flag', () => {
    const buddy = cli('buddy')
    list(buddy)

    const command = buddy.commands.find(candidate => candidate.name === 'list')
    const option = command?.options.find(candidate => candidate.name === 'json')

    expect(option?.names).toContain('J')
    expect(option?.names).toContain('json')
  })

  it('serializes the complete public command contract', () => {
    const buddy = cli('buddy')
    const command = buddy
      .command('deploy [environment]', 'Deploy the application')
      .alias('ship')
      .option('-f, --force', 'Skip confirmation')
      .option('--region <region>', 'Target region', { default: 'us-east-1' })
      .example('buddy deploy production')

    expect(commandInventoryEntry(command)).toEqual({
      name: 'deploy',
      description: 'Deploy the application',
      aliases: ['ship'],
      usage: '$ buddy deploy [environment]',
      arguments: [{ name: 'environment', required: false, variadic: false }],
      options: [
        {
          name: 'force',
          flags: ['f', 'force'],
          description: 'Skip confirmation',
          required: false,
          boolean: true,
          negated: false,
        },
        {
          name: 'region',
          flags: ['region'],
          description: 'Target region',
          required: true,
          boolean: false,
          negated: false,
          default: 'us-east-1',
        },
      ],
      examples: ['buddy deploy production'],
    })
  })
})
