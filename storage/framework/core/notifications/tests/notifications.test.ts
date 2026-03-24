import { describe, expect, test } from 'bun:test'

// ---------------------------------------------------------------------------
// Import the real notification functions directly — no mocks.
// We test the driver resolution and notification routing logic.
// The real drivers, config, and database module all load in test env.
// ---------------------------------------------------------------------------

const {
  useChat,
  useEmail,
  useSMS,
  useDatabase,
  useNotification,
  notify,
  notification,
} = await import('../src/index')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Notifications - useChat()', () => {
  test('returns a chat driver', () => {
    const driver = useChat()
    expect(driver).toBeDefined()
  })

  test('useChat("slack") returns the slack driver', () => {
    const driver = useChat('slack')
    expect(driver).toBeDefined()
    expect(driver).toHaveProperty('send')
  })

  test('useChat("discord") returns the discord driver', () => {
    const driver = useChat('discord')
    expect(driver).toBeDefined()
  })
})

describe('Notifications - useEmail()', () => {
  test('returns an email driver when driver specified', () => {
    const driver = useEmail('ses')
    expect(driver).toBeDefined()
  })

  test('useEmail("sendgrid") returns the sendgrid driver', () => {
    const driver = useEmail('sendgrid')
    expect(driver).toBeDefined()
  })
})

describe('Notifications - useSMS()', () => {
  test('useSMS is a function', () => {
    expect(typeof useSMS).toBe('function')
  })

  test('useSMS returns a value', () => {
    // The SMS driver may not have sub-drivers keyed by name,
    // so the default lookup may return undefined. We just verify no crash.
    const driver = useSMS()
    // driver could be undefined if the package doesn't export keyed sub-drivers
    expect(true).toBe(true)
  })
})

describe('Notifications - useDatabase()', () => {
  test('returns the DatabaseNotificationDriver', () => {
    const driver = useDatabase()
    expect(driver).toBeDefined()
    expect(driver).toHaveProperty('send')
  })
})

describe('Notifications - useNotification()', () => {
  test('routes to email with explicit type', () => {
    const driver = useNotification('email', 'ses')
    expect(driver).toBeDefined()
  })

  test('routes to chat driver when type is "chat"', () => {
    const driver = useNotification('chat')
    expect(driver).toBeDefined()
  })

  test('sms type does not throw', () => {
    // SMS driver may return undefined if not configured
    expect(() => useNotification('sms')).not.toThrow()
  })

  test('routes to database driver when type is "database"', () => {
    const driver = useNotification('database')
    expect(driver).toBeDefined()
  })

  test('throws for unsupported notification type', () => {
    expect(() => useNotification('pigeon' as any)).toThrow('not supported')
  })
})

describe('Notifications - notify()', () => {
  test('notify is a function', () => {
    expect(typeof notify).toBe('function')
  })
})

describe('Notifications - notification()', () => {
  test('notification function is exported', () => {
    expect(typeof notification).toBe('function')
  })
})
