import { describe, expect, test } from 'bun:test'
import {
  defaultMailPreference,
  defaultMailbox,
  mailPreferenceAttributes,
  normalizeStringList,
  serializeMailPreference,
} from './mail-preference'

describe('dashboard mail preferences', () => {
  test('returns the configured mailbox as a complete address', () => {
    expect(defaultMailbox()).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  })

  test('normalizes valid string lists without concealing invalid input', () => {
    expect(normalizeStringList('[" Priority ","Priority",""]')).toBe('["Priority"]')
    expect(() => normalizeStringList('invalid')).toThrow('must contain valid JSON')
    expect(() => normalizeStringList('{"label":"Priority"}')).toThrow('must be a JSON array')
    expect(() => normalizeStringList('["Priority",4]')).toThrow('may contain only strings')
  })

  test('maps transport fields to model attributes', () => {
    const input = {
      ...defaultMailPreference('qa@stacksjs.com'),
      filters: '[" from:qa@example.com ","from:qa@example.com"]',
      blockedSenders: '[]',
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

  test('rejects corrupted persisted preference fields', () => {
    const values: Record<string, unknown> = {
      id: 1,
      mailbox: 'qa@stacksjs.com',
      account_name: 'QA',
      signature: null,
      display_density: 'wide',
      theme: 'system',
      language: 'en',
      default_reply_behavior: 'replyAll',
      send_and_archive: 1,
      auto_advance: 'newer',
      desktop_notifications: 1,
      notification_sound: 'default',
      notification_preview: 1,
      filters: '[]',
      blocked_senders: '[]',
      labels: '[]',
      load_remote_images: 0,
      show_external_content: 0,
      vacation_enabled: 0,
      vacation_start_date: null,
      vacation_end_date: null,
      vacation_subject: null,
      vacation_message: null,
    }
    const record = { get: (key: string) => values[key] }

    expect(() => serializeMailPreference(record)).toThrow('display_density contains an unsupported value')
    values.display_density = 'default'
    values.filters = 'not-json'
    expect(() => serializeMailPreference(record)).toThrow('MailPreference.filters must contain valid JSON')
  })
})
