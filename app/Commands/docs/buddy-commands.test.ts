import type { BuddyCommandInventoryEntry } from '../../../storage/framework/core/buddy/src/commands/list'
import { describe, expect, it } from 'bun:test'
import { renderBuddyCommandReference } from './buddy-commands'

const command: BuddyCommandInventoryEntry = {
  name: 'deploy',
  description: 'Deploy the application',
  aliases: ['ship'],
  usage: '$ buddy deploy [environment]',
  arguments: [{ name: 'environment', required: false, variadic: false }],
  options: [{
    name: 'region',
    flags: ['r', 'region'],
    description: 'Cloud region',
    required: true,
    boolean: false,
    negated: false,
    default: 'us-east-1',
  }],
  examples: ['buddy deploy production'],
}

describe('Buddy command reference', () => {
  it('renders every command contract field', () => {
    const result = renderBuddyCommandReference({ commands: [command], total: 1 })

    expect(result).toContain('**1 commands**')
    expect(result).toContain('### `deploy`')
    expect(result).toContain('Aliases: `ship`')
    expect(result).toContain('Arguments: `[environment]`')
    expect(result).toContain('| `-r`, `--region` | Cloud region | value, required | `"us-east-1"` |')
    expect(result).toContain('buddy deploy production')
  })

  it('sorts commands and rejects incomplete inventories', () => {
    const about = { ...command, name: 'about' }
    const result = renderBuddyCommandReference({ commands: [command, about], total: 2 })

    expect(result.indexOf('### `about`')).toBeLessThan(result.indexOf('### `deploy`'))
    expect(() => renderBuddyCommandReference({ commands: [command], total: 2 })).toThrow('does not match')
  })

  it('rejects duplicate canonical names', () => {
    expect(() => renderBuddyCommandReference({ commands: [command, command], total: 2 })).toThrow('duplicate')
  })
})
