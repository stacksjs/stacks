import { createHmac } from 'node:crypto'
import { describe, expect, test } from 'bun:test'
import { classifySmsIntent, estimateSmsSegments, isWithinSmsQuietHours, parseTwilioInbound, smsComplianceReply, verifyTwilioWebhook } from './compliance'

describe('SMS compliance', () => {
  test('classifies carrier keywords without matching ordinary messages', () => {
    expect(classifySmsIntent(' stop ')).toEqual({ intent: 'opt-out', keyword: 'STOP' })
    expect(classifySmsIntent('START again')).toEqual({ intent: 'opt-in', keyword: 'START' })
    expect(classifySmsIntent('help')).toEqual({ intent: 'help', keyword: 'HELP' })
    expect(classifySmsIntent('Please stop by tomorrow')).toEqual({ intent: 'message' })
  })

  test('parses Twilio inbound fields', () => {
    expect(parseTwilioInbound({ From: '+12025550123', To: '+12025550124', Body: 'STOP', MessageSid: 'SM123' })).toEqual({
      from: '+12025550123',
      to: '+12025550124',
      body: 'STOP',
      messageId: 'SM123',
      intent: 'opt-out',
      keyword: 'STOP',
    })
  })

  test('builds provider-neutral compliance replies', () => {
    expect(smsComplianceReply('opt-out', { appName: 'CommsHQ' })).toContain('unsubscribed')
    expect(smsComplianceReply('opt-in', { appName: 'CommsHQ' })).toContain('resubscribed')
    expect(smsComplianceReply('help', { appName: 'CommsHQ', helpContact: 'support@commshq.org' })).toContain('support@commshq.org')
    expect(smsComplianceReply('message')).toBeNull()
  })

  test('verifies Twilio signatures in constant-time compatible form', () => {
    const url = 'https://commshq.org/webhooks/twilio/sms'
    const fields = { Body: 'STOP', From: '+12025550123', To: '+12025550124' }
    const payload = `${url}BodySTOPFrom+12025550123To+12025550124`
    const signature = createHmac('sha1', 'secret').update(payload).digest('base64')
    expect(verifyTwilioWebhook(url, fields, signature, 'secret')).toBe(true)
    expect(verifyTwilioWebhook(url, fields, `${signature}x`, 'secret')).toBe(false)
  })

  test('estimates GSM-7 and UCS-2 segments', () => {
    expect(estimateSmsSegments('A'.repeat(160))).toMatchObject({ encoding: 'gsm-7', segments: 1 })
    expect(estimateSmsSegments('A'.repeat(161))).toMatchObject({ encoding: 'gsm-7', segments: 2 })
    expect(estimateSmsSegments('Hello 👋')).toMatchObject({ encoding: 'ucs-2', segments: 1 })
  })

  test('handles quiet hours that cross midnight', () => {
    expect(isWithinSmsQuietHours(new Date('2026-01-01T21:00:00Z'), { startHour: 20, endHour: 8 })).toBe(true)
    expect(isWithinSmsQuietHours(new Date('2026-01-01T12:00:00Z'), { startHour: 20, endHour: 8 })).toBe(false)
  })
})
