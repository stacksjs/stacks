# Mocking

Mocking allows you to replace dependencies with controlled substitutes during testing. Stacks provides comprehensive mocking utilities for functions, modules, HTTP requests, and more.

## Overview

Mocking helps you:

- **Isolate code** - Test units without dependencies
- **Control behavior** - Define exact responses
- **Verify interactions** - Assert function calls
- **Avoid side effects** - No real HTTP requests, emails, etc.

## Function Mocking

### Creating Mocks

```typescript
import { describe, expect, it, mock } from 'bun:test'

describe('Mocking', () => {
  it('creates a mock function', () => {
    const mockFn = mock(() => 'mocked value')

    const result = mockFn()

    expect(result).toBe('mocked value')
    expect(mockFn).toHaveBeenCalled()
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('tracks call arguments', () => {
    const mockFn = mock((a: number, b: number) => a + b)

    mockFn(1, 2)
    mockFn(3, 4)

    expect(mockFn).toHaveBeenCalledWith(1, 2)
    expect(mockFn).toHaveBeenCalledWith(3, 4)
    expect(mockFn).toHaveBeenCalledTimes(2)
  })
})
```

### Spying on Functions

```typescript
import { describe, expect, it, spyOn } from 'bun:test'
import * as mathUtils from '@/utils/math'

describe('Spying', () => {
  it('spies on existing function', () => {
    const spy = spyOn(mathUtils, 'add')

    mathUtils.add(1, 2)

    expect(spy).toHaveBeenCalledWith(1, 2)
    expect(spy).toHaveReturned()
  })

  it('replaces implementation', () => {
    const spy = spyOn(mathUtils, 'add').mockReturnValue(100)

    const result = mathUtils.add(1, 2)

    expect(result).toBe(100)  // Not 3
    expect(spy).toHaveBeenCalled()
  })
})
```

### Mock Return Values

```typescript
import { mock } from 'bun:test'

// Return a value
const mockFn = mock().mockReturnValue('value')

// Return different values on successive calls
const mockFn = mock()
  .mockReturnValueOnce('first')
  .mockReturnValueOnce('second')
  .mockReturnValue('default')

mockFn() // 'first'
mockFn() // 'second'
mockFn() // 'default'
mockFn() // 'default'

// Return resolved promise
const asyncMock = mock().mockResolvedValue({ data: 'test' })
await asyncMock() // { data: 'test' }

// Return rejected promise
const errorMock = mock().mockRejectedValue(new Error('Failed'))
await errorMock() // throws Error: Failed
```

### Mock Implementations

```typescript
import { mock } from 'bun:test'

// Custom implementation
const mockFn = mock().mockImplementation((x: number) => x * 2)
mockFn(5) // 10

// One-time implementation
const mockFn = mock()
  .mockImplementationOnce(() => 'first call')
  .mockImplementation(() => 'other calls')

mockFn() // 'first call'
mockFn() // 'other calls'
```

## Module Mocking

### Mocking Entire Modules

```typescript
import { beforeAll, describe, expect, it, mock } from 'bun:test'

// Mock module before importing code that uses it
mock.module('@/services/email', () => ({
  sendEmail: mock().mockResolvedValue({ sent: true }),
  sendBulkEmail: mock().mockResolvedValue({ sent: 5 }),
}))

import { notifyUser } from '@/services/notification'

describe('Notification Service', () => {
  it('sends email notification', async () => {
    const result = await notifyUser(1, 'Hello!')

    expect(result.sent).toBe(true)
  })
})
```

### Partial Module Mocking

```typescript
import { mock } from 'bun:test'

// Keep original implementations except specified
mock.module('@/services/api', () => {
  const actual = require('@/services/api')
  return {
    ...actual,
    fetchUser: mock().mockResolvedValue({ id: 1, name: 'Mock User' }),
  }
})
```

### Restoring Mocks

```typescript
import { afterEach, describe, it, mock, spyOn } from 'bun:test'
import * as api from '@/services/api'

describe('API Tests', () => {
  afterEach(() => {
    // Restore all mocks
    mock.restore()
  })

  it('mocks API call', () => {
    const spy = spyOn(api, 'fetchData').mockReturnValue({ data: 'mocked' })

    // Test code...

    spy.mockRestore()  // Restore just this spy
  })
})
```

## HTTP Mocking

### Mocking Fetch

```typescript
import { describe, expect, it, mock, spyOn } from 'bun:test'

describe('API Client', () => {
  it('mocks fetch requests', async () => {
    const mockFetch = spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 1, name: 'Test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const response = await fetch('/api/users/1')
    const data = await response.json()

    expect(data.name).toBe('Test')
    expect(mockFetch).toHaveBeenCalledWith('/api/users/1')
  })

  it('mocks different responses', async () => {
    spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ page: 1 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ page: 2 })))

    const first = await fetch('/api/items').then(r => r.json())
    const second = await fetch('/api/items').then(r => r.json())

    expect(first.page).toBe(1)
    expect(second.page).toBe(2)
  })

  it('mocks fetch errors', async () => {
    spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))

    await expect(fetch('/api/users')).rejects.toThrow('Network error')
  })
})
```

### Using Mock Server

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mockServer } from '@stacksjs/testing'

describe('External API', () => {
  beforeAll(() => {
    mockServer.start()

    // Define mock routes
    mockServer.get('/api/users', () => ({
      status: 200,
      body: [{ id: 1, name: 'User 1' }],
    }))

    mockServer.post('/api/users', (req) => ({
      status: 201,
      body: { id: 2, ...req.body },
    }))

    mockServer.get('/api/users/:id', (req) => ({
      status: 200,
      body: { id: req.params.id, name: `User ${req.params.id}` },
    }))
  })

  afterAll(() => {
    mockServer.stop()
  })

  it('fetches users', async () => {
    const users = await apiClient.getUsers()
    expect(users).toHaveLength(1)
  })

  it('creates user', async () => {
    const user = await apiClient.createUser({ name: 'New User' })
    expect(user.id).toBe(2)
    expect(user.name).toBe('New User')
  })
})
```

## Time Mocking

### Mocking Date/Time

```typescript
import { afterEach, beforeEach, describe, expect, it, setSystemTime } from 'bun:test'

describe('Time-dependent code', () => {
  beforeEach(() => {
    // Freeze time at specific date
    setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    // Restore real time
    setSystemTime()
  })

  it('uses mocked time', () => {
    const now = new Date()
    expect(now.toISOString()).toBe('2024-01-15T12:00:00.000Z')
  })

  it('calculates expiry correctly', () => {
    const token = createToken({ expiresIn: 3600 })  // 1 hour

    expect(token.expiresAt).toEqual(new Date('2024-01-15T13:00:00Z'))
  })

  it('detects expired tokens', () => {
    const token = { expiresAt: new Date('2024-01-15T11:00:00Z') }

    expect(isExpired(token)).toBe(true)
  })
})
```

### Advancing Time

```typescript
import { setSystemTime } from 'bun:test'

it('handles time progression', () => {
  setSystemTime(new Date('2024-01-15T12:00:00Z'))

  const scheduler = new TaskScheduler()
  scheduler.scheduleTask(() => {}, { delay: 3600000 })  // 1 hour

  // Advance time by 1 hour
  setSystemTime(new Date('2024-01-15T13:00:00Z'))

  expect(scheduler.hasPendingTasks()).toBe(false)
})
```

## Mocking External Services

### Database Mocking

```typescript
import { describe, expect, it, mock } from 'bun:test'

mock.module('@stacksjs/database', () => ({
  db: {
    selectFrom: mock().mockReturnValue({
      where: mock().mockReturnValue({
        selectAll: mock().mockReturnValue({
          execute: mock().mockResolvedValue([
            { id: 1, name: 'Mock User' },
          ]),
        }),
      }),
    }),
  },
}))

import { UserService } from '@/services/UserService'

describe('UserService', () => {
  it('returns users from database', async () => {
    const users = await UserService.findAll()

    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Mock User')
  })
})
```

### Email Service Mocking

```typescript
import { describe, expect, it, mock } from 'bun:test'
import { MockMailer } from '@stacksjs/testing'

describe('Email Notifications', () => {
  const mailer = new MockMailer()

  it('sends welcome email', async () => {
    await sendWelcomeEmail('user@example.com')

    expect(mailer.sent).toHaveLength(1)
    expect(mailer.sent[0].to).toBe('user@example.com')
    expect(mailer.sent[0].subject).toContain('Welcome')
  })

  it('queues bulk emails', async () => {
    await sendBulkNewsletter(['a@test.com', 'b@test.com'])

    expect(mailer.queued).toHaveLength(2)
  })
})
```

### Queue Mocking

```typescript
import { describe, expect, it } from 'bun:test'
import { fake, getFakeQueue, restore } from '@stacksjs/queue'

describe('Order Processing', () => {
  beforeEach(() => {
    fake()  // Enable queue faking
  })

  afterEach(() => {
    restore()  // Restore real queue
  })

  it('dispatches order processing job', async () => {
    await createOrder({ productId: 1, quantity: 2 })

    const fakeQueue = getFakeQueue()

    expect(fakeQueue.hasDispatched('ProcessOrder')).toBe(true)
    expect(fakeQueue.dispatched('ProcessOrder')[0].data).toEqual({
      productId: 1,
      quantity: 2,
    })
  })
})
```

## Mock Assertions

### Call Assertions

```typescript
import { expect, mock } from 'bun:test'

const mockFn = mock()

mockFn('a')
mockFn('b', 'c')

// Called at all
expect(mockFn).toHaveBeenCalled()

// Called specific number of times
expect(mockFn).toHaveBeenCalledTimes(2)

// Called with specific arguments
expect(mockFn).toHaveBeenCalledWith('a')
expect(mockFn).toHaveBeenCalledWith('b', 'c')

// Last call arguments
expect(mockFn).toHaveBeenLastCalledWith('b', 'c')

// Nth call arguments
expect(mockFn).toHaveBeenNthCalledWith(1, 'a')
expect(mockFn).toHaveBeenNthCalledWith(2, 'b', 'c')
```

### Return Value Assertions

```typescript
const mockFn = mock()
  .mockReturnValueOnce(1)
  .mockReturnValueOnce(2)

mockFn() // 1
mockFn() // 2

expect(mockFn).toHaveReturned()
expect(mockFn).toHaveReturnedTimes(2)
expect(mockFn).toHaveReturnedWith(1)
expect(mockFn).toHaveLastReturnedWith(2)
expect(mockFn).toHaveNthReturnedWith(1, 1)
```

### Clearing Mocks

```typescript
const mockFn = mock()

mockFn('test')
expect(mockFn).toHaveBeenCalled()

// Clear call history but keep implementation
mockFn.mockClear()
expect(mockFn).not.toHaveBeenCalled()

// Reset everything (calls + implementation)
mockFn.mockReset()

// Restore original (for spies)
mockFn.mockRestore()
```

## Best Practices

### DO

- **Mock at boundaries** - External APIs, databases, file system
- **Use minimal mocks** - Only mock what's necessary
- **Verify interactions** - Assert mocks were called correctly
- **Clean up mocks** - Restore in afterEach/afterAll
- **Mock consistently** - Same mock behavior across related tests

### DON'T

- **Don't over-mock** - Too many mocks indicate tight coupling
- **Don't mock implementation** - Mock behavior, not internals
- **Don't share mock state** - Reset between tests
- **Don't mock what you own** - Use real implementations where possible

### Example: Good vs Bad Mocking

```typescript
// BAD: Mocking implementation details
const mockInternalMethod = spyOn(userService, '_hashPassword')

// GOOD: Mocking external boundary
const mockBcrypt = spyOn(bcrypt, 'hash').mockResolvedValue('hashed')

// BAD: Testing mock, not real behavior
const mock = mock().mockReturnValue(true)
expect(mock()).toBe(true)  // Testing the mock itself

// GOOD: Testing real code with mocked dependencies
spyOn(emailService, 'send').mockResolvedValue({ sent: true })
const result = await notifyUser(1)  // Tests notifyUser, not mock
expect(result.notified).toBe(true)
```

## Related Documentation

- **[Testing Overview](/testing/getting-started)** - Getting started with testing
- **[Unit Tests](/testing/unit-tests)** - Testing isolated functions
- **[HTTP Tests](/testing/http-tests)** - Testing API endpoints
- **[Database Testing](/testing/database)** - Database test utilities
