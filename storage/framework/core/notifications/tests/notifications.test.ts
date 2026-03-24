import { describe, expect, mock, test } from 'bun:test'

// ---------------------------------------------------------------------------
// Mock external deps
// ---------------------------------------------------------------------------

const mockChatSend = mock(() => Promise.resolve())
const mockEmailSend = mock(() => Promise.resolve())
const mockSmsSend = mock(() => Promise.resolve())
const mockDbCreate = mock(() => Promise.resolve({
  id: 1,
  user_id: 1,
  type: 'test',
  data: '{}',
  read_at: null,
  created_at: new Date().toISOString(),
  updated_at: null,
}))

mock.module('@stacksjs/cli', () => ({
  log: {
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}))

mock.module('@stacksjs/config', () => ({
  notification: {
    default: 'email',
  },
}))

mock.module('@stacksjs/database', () => ({
  db: {
    insertInto: () => ({
      values: () => ({
        execute: () => Promise.resolve([{ insertId: 1 }]),
      }),
    }),
  },
}))

// Mock the driver modules with the correct shape
mock.module('../src/drivers', () => ({
  chat: {
    slack: { send: mockChatSend },
    discord: { send: mockChatSend },
  },
  email: {
    ses: { send: mockEmailSend },
    sendgrid: { send: mockEmailSend },
  },
  sms: {
    twilio: { send: mockSmsSend },
    vonage: { send: mockSmsSend },
  },
}))

mock.module('../src/drivers/database', () => ({
  DatabaseNotificationDriver: {
    send: mockDbCreate,
    create: mockDbCreate,
  },
}))

// ---------------------------------------------------------------------------
// Import after mocks
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
  test('returns an SMS driver', () => {
    const driver = useSMS()
    expect(driver).toBeDefined()
  })

  test('useSMS("twilio") returns the twilio driver', () => {
    const driver = useSMS('twilio')
    expect(driver).toBeDefined()
  })
})

describe('Notifications - useDatabase()', () => {
  test('returns the DatabaseNotificationDriver', () => {
    const driver = useDatabase()
    expect(driver).toBeDefined()
    expect(driver).toHaveProperty('create')
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

  test('routes to sms driver when type is "sms"', () => {
    const driver = useNotification('sms')
    expect(driver).toBeDefined()
  })

  test('routes to database driver when type is "database"', () => {
    const driver = useNotification('database')
    expect(driver).toBeDefined()
    expect(driver).toHaveProperty('create')
  })

  test('throws for unsupported notification type', () => {
    expect(() => useNotification('pigeon' as any)).toThrow('not supported')
  })
})

describe('Notifications - notify()', () => {
  test('sends to email channel by default', async () => {
    const results = await notify(
      { email: 'user@example.com' },
      { body: 'Hello' },
    )
    expect(results).toHaveLength(1)
    expect(results[0].channel).toBe('email')
    expect(results[0].success).toBe(true)
  })

  test('sends to multiple channels simultaneously', async () => {
    const results = await notify(
      { email: 'user@example.com', phone: '+1234567890', userId: 1 },
      { subject: 'Test', body: 'Multi-channel' },
      ['email', 'sms', 'database'],
    )
    expect(results).toHaveLength(3)
    expect(results.map(r => r.channel)).toEqual(['email', 'sms', 'database'])
  })

  test('database channel sends successfully', async () => {
    const results = await notify(
      { userId: 1 },
      { subject: 'Test', body: 'DB only' },
      ['database'],
    )
    expect(results).toHaveLength(1)
    expect(results[0].channel).toBe('database')
    expect(results[0].success).toBe(true)
  })
})

describe('Notifications - notification()', () => {
  test('notification function is exported', () => {
    expect(typeof notification).toBe('function')
  })
})
