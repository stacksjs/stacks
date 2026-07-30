import { describe, expect, test } from 'bun:test'
import { resolveDashboardDeliveryChannel } from './NotificationDeliveryIndexAction'

describe('notification delivery channel routing', () => {
  test('uses an explicit query or route channel', () => {
    expect(resolveDashboardDeliveryChannel('https://example.test/api/notifications/history', 'email')).toBe('email')
    expect(resolveDashboardDeliveryChannel('https://example.test/api/notifications/history', undefined, 'sms')).toBe('sms')
  })

  test('supports the legacy email and SMS route paths', () => {
    expect(resolveDashboardDeliveryChannel('https://example.test/api/notifications/email')).toBe('email')
    expect(resolveDashboardDeliveryChannel('https://example.test/api/notifications/sms')).toBe('sms')
  })

  test('rejects unsupported channels', () => {
    expect(resolveDashboardDeliveryChannel('https://example.test/api/notifications/push')).toBeNull()
  })
})
