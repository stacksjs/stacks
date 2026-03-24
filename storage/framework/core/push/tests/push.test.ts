import { describe, expect, test } from 'bun:test'

describe('Push Module Exports', () => {
  test('send function is exported', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.send).toBe('function')
  })

  test('configureFCM function is exported', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.configureFCM).toBe('function')
  })

  test('expo module is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.expo).toBeDefined()
  })

  test('fcm module is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.fcm).toBeDefined()
  })
})

describe('Push Notification Interface', () => {
  test('PushNotification type fields are documented via send signature', async () => {
    const mod = await import('../src/index')
    // send accepts (to, notification, options) - verify it is callable
    expect(typeof mod.send).toBe('function')
    expect(mod.send.length).toBeGreaterThanOrEqual(2)
  })

  test('send returns a failure result for unknown driver', async () => {
    const { send } = await import('../src/index')
    const result = await send('token123', { body: 'test' }, { driver: 'unknown' as any })
    expect(result.success).toBe(false)
    expect(result.message).toContain('Unknown push driver')
  })
})

describe('Expo Driver', () => {
  test('expo has send function', async () => {
    const { expo } = await import('../src/index')
    expect(typeof expo.send).toBe('function')
  })

  test('expo has sendBatch function', async () => {
    const { expo } = await import('../src/index')
    expect(typeof expo.sendBatch).toBe('function')
  })

  test('expo has getReceipts function', async () => {
    const { expo } = await import('../src/index')
    expect(typeof expo.getReceipts).toBe('function')
  })

  test('expo has isExpoPushToken function', async () => {
    const { expo } = await import('../src/index')
    expect(typeof expo.isExpoPushToken).toBe('function')
  })

  test('isExpoPushToken validates Expo push token format', async () => {
    const { expo } = await import('../src/index')
    expect(expo.isExpoPushToken('ExponentPushToken[abc123]')).toBe(true)
    expect(expo.isExpoPushToken('ExpoPushToken[xyz789]')).toBe(true)
    expect(expo.isExpoPushToken('some-valid-token-id')).toBe(true)
  })
})

describe('FCM Driver', () => {
  test('fcm has send function', async () => {
    const { fcm } = await import('../src/index')
    expect(typeof fcm.send).toBe('function')
  })

  test('fcm has sendMulticast function', async () => {
    const { fcm } = await import('../src/index')
    expect(typeof fcm.sendMulticast).toBe('function')
  })

  test('fcm has sendToTopic function', async () => {
    const { fcm } = await import('../src/index')
    expect(typeof fcm.sendToTopic).toBe('function')
  })

  test('fcm has configure function', async () => {
    const { fcm } = await import('../src/index')
    expect(typeof fcm.configure).toBe('function')
  })

  test('fcm has subscribeToTopic function', async () => {
    const { fcm } = await import('../src/index')
    expect(typeof fcm.subscribeToTopic).toBe('function')
  })

  test('fcm has unsubscribeFromTopic function', async () => {
    const { fcm } = await import('../src/index')
    expect(typeof fcm.unsubscribeFromTopic).toBe('function')
  })
})
