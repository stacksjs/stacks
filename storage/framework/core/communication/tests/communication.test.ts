import { describe, expect, test } from 'bun:test'

describe('communication module exports', () => {
  test('Communication class is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.Communication).toBeDefined()
    expect(typeof mod.Communication).toBe('function')
  })

  test('SmsSDK class is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.SmsSDK).toBeDefined()
    expect(typeof mod.SmsSDK).toBe('function')
  })

  test('communication singleton is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.communication).toBeDefined()
    expect(mod.communication).toBeInstanceOf(mod.Communication)
  })

  test('notify convenience function is exported', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.notify).toBe('function')
  })

  test('sendEmail convenience function is exported', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.sendEmail).toBe('function')
  })

  test('sendSms convenience function is exported', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.sendSms).toBe('function')
  })

  test('default export is Communication class', async () => {
    const mod = await import('../src/index')
    expect(mod.default).toBe(mod.Communication)
  })
})

describe('Communication class', () => {
  test('constructor creates email and sms instances', async () => {
    const { Communication } = await import('../src/index')
    const comm = new Communication()
    expect(comm.email).toBeDefined()
    expect(comm.sms).toBeDefined()
  })

  test('constructor accepts region option', async () => {
    const { Communication } = await import('../src/index')
    const comm = new Communication({ region: 'eu-west-1' })
    expect(comm.email).toBeDefined()
    expect(comm.sms).toBeDefined()
  })
})

describe('SmsSDK', () => {
  test('can be instantiated', async () => {
    const { SmsSDK } = await import('../src/index')
    const sms = new SmsSDK()
    expect(sms).toBeDefined()
  })

  test('can be instantiated with options', async () => {
    const { SmsSDK } = await import('../src/index')
    const sms = new SmsSDK({ region: 'us-west-2', appId: 'test-app' })
    expect(sms).toBeDefined()
  })

  test('send returns error when PinpointClient unavailable', async () => {
    const { SmsSDK } = await import('../src/index')
    const sms = new SmsSDK()
    const result = await sms.send({ to: '+1234567890', body: 'test' })
    expect(result.success).toBe(false)
  })

  test('sendBulk processes multiple messages', async () => {
    const { SmsSDK } = await import('../src/index')
    const sms = new SmsSDK()
    const results = await sms.sendBulk([
      { to: '+1111111111', body: 'msg1' },
      { to: '+2222222222', body: 'msg2' },
    ])
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBe(2)
  })

  test('sendTemplate delegates to send', async () => {
    const { SmsSDK } = await import('../src/index')
    const sms = new SmsSDK()
    const result = await sms.sendTemplate({
      to: '+1234567890',
      template: 'Hello {{name}}',
      data: { name: 'World' },
    })
    expect(result).toBeDefined()
    expect(typeof result.success).toBe('boolean')
  })
})

describe('Communication notify', () => {
  test('returns failure when user has no contact methods', async () => {
    const { Communication } = await import('../src/index')
    const comm = new Communication()
    const result = await comm.sendBestChannel({}, 'test message')
    expect(result.success).toBe(false)
    expect(result.results[0]!.error).toContain('No contact method')
  })

  test('notify respects quiet hours for non-high priority', async () => {
    const { Communication } = await import('../src/index')
    const comm = new Communication()

    // Set quiet hours that cover all day
    const user = {
      email: 'test@test.com',
      preferences: {
        channels: ['email' as const],
        quietHours: { start: '00:00', end: '23:59' },
      },
    }

    const result = await comm.notify(user, {
      message: 'test',
      channels: ['email'],
      priority: 'normal',
    })
    expect(result.success).toBe(false)
    expect(result.results[0]!.error).toContain('quiet hours')
  })
})
