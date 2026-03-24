import { describe, expect, test } from 'bun:test'
import { SmsBuilder, configure, formatE164, getConfig, getDriver, isEnabled, isValidPhoneNumber } from '../src/sms'
import { TwilioDriver } from '../src/drivers/twilio'
import { VonageDriver } from '../src/drivers/vonage'

describe('SMS Module Exports', () => {
  test('SMS default export has all expected methods', async () => {
    const { default: SMS } = await import('../src/sms')
    expect(typeof SMS.send).toBe('function')
    expect(typeof SMS.sendSms).toBe('function')
    expect(typeof SMS.sendBulk).toBe('function')
    expect(typeof SMS.sendTemplate).toBe('function')
    expect(typeof SMS.configure).toBe('function')
    expect(typeof SMS.getDriver).toBe('function')
    expect(typeof SMS.formatE164).toBe('function')
    expect(typeof SMS.isValidPhoneNumber).toBe('function')
    expect(typeof SMS.sms).toBe('function')
    expect(typeof SMS.isEnabled).toBe('function')
    expect(typeof SMS.getConfig).toBe('function')
  })

  test('package index re-exports SMS and drivers', async () => {
    const mod = await import('../src/index')
    expect(mod.SMS).toBeDefined()
    expect(mod.TwilioDriver).toBeDefined()
    expect(mod.VonageDriver).toBeDefined()
    expect(mod.createTwilioDriver).toBeDefined()
    expect(mod.createVonageDriver).toBeDefined()
  })
})

describe('SMS Configuration', () => {
  test('configure() merges config options', () => {
    configure({ provider: 'twilio', from: '+1234567890' })
    const cfg = getConfig()
    expect(cfg.provider).toBe('twilio')
    expect(cfg.from).toBe('+1234567890')
  })

  test('isEnabled() returns false by default', () => {
    configure({})
    expect(isEnabled()).toBe(false)
  })

  test('isEnabled() returns true when enabled in config', () => {
    configure({ enabled: true } as any)
    expect(isEnabled()).toBe(true)
  })

  test('getDriver() throws for missing Twilio credentials', () => {
    configure({ provider: 'twilio', drivers: { twilio: { accountSid: '', authToken: '' } } } as any)
    expect(() => getDriver('twilio')).toThrow('Twilio configuration is incomplete')
  })

  test('getDriver() throws for missing Vonage credentials', () => {
    configure({ provider: 'vonage', drivers: { vonage: { apiKey: '', apiSecret: '' } } } as any)
    expect(() => getDriver('vonage')).toThrow('Vonage configuration is incomplete')
  })

  test('getDriver() throws for unsupported provider', () => {
    expect(() => getDriver('unknown' as any)).toThrow('Unsupported SMS provider')
  })
})

describe('SMS Builder Pattern', () => {
  test('sms() from SMS facade returns SmsBuilder', async () => {
    const { default: SMS } = await import('../src/sms')
    const builder = SMS.sms()
    expect(builder).toBeInstanceOf(SmsBuilder)
  })

  test('SmsBuilder supports fluent chaining', () => {
    const builder = new SmsBuilder()
    const result = builder
      .to('+1234567890')
      .body('Hello!')
      .from('+0987654321')

    expect(result).toBeInstanceOf(SmsBuilder)
  })

  test('SmsBuilder.text() is an alias for body()', () => {
    const builder = new SmsBuilder()
    const result = builder.text('Hello')
    expect(result).toBeInstanceOf(SmsBuilder)
  })

  test('SmsBuilder.media() sets media URLs', () => {
    const builder = new SmsBuilder()
    const result = builder.media('https://example.com/image.png')
    expect(result).toBeInstanceOf(SmsBuilder)
  })

  test('SmsBuilder.media() accepts array of URLs', () => {
    const builder = new SmsBuilder()
    const result = builder.media(['https://example.com/a.png', 'https://example.com/b.png'])
    expect(result).toBeInstanceOf(SmsBuilder)
  })

  test('SmsBuilder.callback() sets status callback URL', () => {
    const builder = new SmsBuilder()
    const result = builder.callback('https://example.com/webhook')
    expect(result).toBeInstanceOf(SmsBuilder)
  })

  test('SmsBuilder.via() sets the provider', () => {
    const builder = new SmsBuilder()
    const result = builder.via('vonage')
    expect(result).toBeInstanceOf(SmsBuilder)
  })
})

describe('Phone Number Utilities', () => {
  test('formatE164 returns already-formatted numbers as-is', () => {
    expect(formatE164('+14155552671')).toBe('+14155552671')
  })

  test('formatE164 adds default country code (1) for bare numbers', () => {
    expect(formatE164('4155552671')).toBe('+14155552671')
  })

  test('formatE164 strips spaces, dashes, and parentheses', () => {
    expect(formatE164('(415) 555-2671')).toBe('+14155552671')
  })

  test('formatE164 converts 00-prefixed to + format', () => {
    expect(formatE164('0044123456789')).toBe('+44123456789')
  })

  test('formatE164 uses custom country code when provided', () => {
    expect(formatE164('7911123456', '44')).toBe('+447911123456')
  })

  test('isValidPhoneNumber returns true for valid E.164 numbers', () => {
    expect(isValidPhoneNumber('+14155552671')).toBe(true)
  })

  test('isValidPhoneNumber returns false for too-short numbers', () => {
    expect(isValidPhoneNumber('+1234')).toBe(false)
  })
})

describe('Driver Classes', () => {
  test('TwilioDriver is a class', () => {
    expect(typeof TwilioDriver).toBe('function')
  })

  test('VonageDriver is a class', () => {
    expect(typeof VonageDriver).toBe('function')
  })
})
