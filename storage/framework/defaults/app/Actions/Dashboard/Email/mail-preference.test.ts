import { describe, expect, test } from 'bun:test'
import {
  defaultMailPreference,
  defaultMailbox,
  mailPreferenceAttributes,
  normalizeStringList,
} from './mail-preference'

describe('dashboard mail preferences', () => {
  test('uses the first configured mailbox', () => {
    expect(defaultMailbox()).toBe('chris@stacksjs.com')
  })

  test('normalizes persisted string lists', () => {
    expect(normalizeStringList('[" Priority ","Priority","",4]')).toBe('["Priority"]')
    expect(normalizeStringList('invalid')).toBe('[]')
    expect(normalizeStringList('{"label":"Priority"}')).toBe('[]')
  })

  test('maps transport fields to model attributes', () => {
    const input = {
      ...defaultMailPreference('qa@stacksjs.com'),
      filters: '[" from:qa@example.com ","from:qa@example.com"]',
      blockedSenders: 'invalid',
    }

    expect(mailPreferenceAttributes(input)).toMatchObject({
      mailbox: 'qa@stacksjs.com',
      account_name: 'Stacks',
      filters: '["from:qa@example.com"]',
      blocked_senders: '[]',
      display_density: 'default',
      send_and_archive: true,
    })
  })
})
