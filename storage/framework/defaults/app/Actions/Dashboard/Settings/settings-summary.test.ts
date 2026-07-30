import { describe, expect, test } from 'bun:test'
import { buildDashboardSettings } from './settings-summary'

describe('dashboard settings summary', () => {
  test('reflects active config without exposing credential values', () => {
    const summary = buildDashboardSettings({
      app: {
        name: 'Acme',
        url: 'https://acme.test',
        timezone: 'UTC',
        locale: 'en',
      },
      auth: {
        enabled: true,
        tokenExpiry: 3_600_000,
      },
      security: {
        firewall: {
          enabled: true,
          ipAddresses: ['127.0.0.1'],
        },
      },
      email: {
        notifications: {
          newEmail: true,
          bounces: false,
          complaints: true,
        },
      },
      services: {
        stripe: {
          secretKey: 'stripe-secret',
          publicKey: '',
        },
        github: {
          clientId: '',
          clientSecret: '',
        },
      },
    })

    expect(summary.generalSettings).toContainEqual({ key: 'Site Name', value: 'Acme', type: 'text' })
    expect(summary.securitySettings).toContainEqual({ key: 'IP Whitelist Entries', value: 1, type: 'number' })
    expect(summary.notificationSettings).toContainEqual({ key: 'Bounce Notifications', value: false, type: 'toggle' })
    expect(summary.integrations.find(item => item.name === 'Stripe')?.status).toBe('configured')
    expect(summary.integrations.find(item => item.name === 'GitHub')?.status).toBe('not_configured')
    expect(JSON.stringify(summary)).not.toContain('stripe-secret')
  })

  test('uses honest empty values when optional config is absent', () => {
    const summary = buildDashboardSettings({})

    expect(summary.generalSettings.every(setting => setting.value === '')).toBe(true)
    expect(summary.integrations.every(item => item.status === 'not_configured')).toBe(true)
  })
})
