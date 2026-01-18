# Testing Package

A comprehensive testing framework built on Bun's native test runner, providing assertions, database testing utilities, feature testing, factories, and mocking capabilities.

## Installation

```bash
bun add @stacksjs/testing
```

## Basic Usage

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@stacksjs/testing'

describe('User', () => {
  it('should create a new user', async () => {
    const user = await User.create({ name: 'John', email: 'john@test.com' })
    expect(user.name).toBe('John')
    expect(user.email).toBe('john@test.com')
  })
})
```

## Test Structure

### Describe and It

```typescript
import { describe, it, expect } from '@stacksjs/testing'

describe('Calculator', () => {
  describe('add', () => {
    it('should add two positive numbers', () => {
      expect(add(2, 3)).toBe(5)
    })

    it('should handle negative numbers', () => {
      expect(add(-1, 1)).toBe(0)
    })
  })

  describe('divide', () => {
    it('should divide two numbers', () => {
      expect(divide(10, 2)).toBe(5)
    })

    it('should throw on division by zero', () => {
      expect(() => divide(10, 0)).toThrow('Division by zero')
    })
  })
})
```

### Lifecycle Hooks

```typescript
import { describe, it, beforeAll, beforeEach, afterAll, afterEach } from '@stacksjs/testing'

describe('Database Tests', () => {
  beforeAll(async () => {
    // Run once before all tests in this describe block
    await database.connect()
  })

  beforeEach(async () => {
    // Run before each test
    await database.beginTransaction()
  })

  afterEach(async () => {
    // Run after each test
    await database.rollback()
  })

  afterAll(async () => {
    // Run once after all tests
    await database.disconnect()
  })

  it('should insert record', async () => {
    await User.create({ name: 'John' })
    const count = await User.count()
    expect(count).toBe(1)
  })
})
```

## Assertions

### Basic Matchers

```typescript
import { expect } from '@stacksjs/testing'

// Equality
expect(value).toBe(42)           // Strict equality
expect(value).toEqual({ a: 1 })  // Deep equality
expect(value).not.toBe(0)        // Negation

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeDefined()

// Numbers
expect(value).toBeGreaterThan(5)
expect(value).toBeGreaterThanOrEqual(5)
expect(value).toBeLessThan(10)
expect(value).toBeLessThanOrEqual(10)
expect(value).toBeCloseTo(0.3, 2) // For floating point

// Strings
expect(str).toContain('hello')
expect(str).toMatch(/pattern/)
expect(str).toHaveLength(5)

// Arrays
expect(arr).toContain('item')
expect(arr).toHaveLength(3)
expect(arr).toEqual(['a', 'b', 'c'])

// Objects
expect(obj).toHaveProperty('name')
expect(obj).toHaveProperty('address.city', 'NYC')
expect(obj).toMatchObject({ name: 'John' })
```

### Exceptions

```typescript
// Expect function to throw
expect(() => throwingFunction()).toThrow()
expect(() => throwingFunction()).toThrow('error message')
expect(() => throwingFunction()).toThrow(CustomError)
expect(() => throwingFunction()).toThrow(/pattern/)

// Async throw
await expect(async () => await asyncThrow()).rejects.toThrow()
```

### Async Assertions

```typescript
// Promise resolves
await expect(promise).resolves.toBe(value)
await expect(promise).resolves.toEqual({ data: 'value' })

// Promise rejects
await expect(promise).rejects.toThrow('error')
await expect(promise).rejects.toBeInstanceOf(Error)
```

### Type Assertions

```typescript
expect(value).toBeInstanceOf(Date)
expect(value).toBeInstanceOf(CustomClass)
expect(typeof value).toBe('string')
expect(typeof value).toBe('number')
```

## Database Testing

### Using Test Database

```typescript
import { describe, it, expect, useDatabaseTransactions } from '@stacksjs/testing'

describe('User Model', () => {
  // Wrap each test in a transaction that rolls back
  useDatabaseTransactions()

  it('should create user', async () => {
    const user = await User.create({ name: 'Test User', email: 'test@test.com' })
    expect(user.id).toBeDefined()

    // Automatically rolled back after test
  })
})
```

### Database Assertions

```typescript
import { assertDatabaseHas, assertDatabaseMissing } from '@stacksjs/testing'

it('should save user to database', async () => {
  await User.create({ name: 'John', email: 'john@test.com' })

  // Assert record exists
  await assertDatabaseHas('users', {
    email: 'john@test.com'
  })
})

it('should delete user', async () => {
  const user = await User.create({ name: 'John', email: 'john@test.com' })
  await user.delete()

  // Assert record doesn't exist
  await assertDatabaseMissing('users', {
    email: 'john@test.com'
  })
})
```

### Database Count Assertions

```typescript
import { assertDatabaseCount } from '@stacksjs/testing'

it('should have correct number of users', async () => {
  await User.create({ name: 'User 1' })
  await User.create({ name: 'User 2' })

  await assertDatabaseCount('users', 2)
})
```

### Soft Delete Assertions

```typescript
import { assertSoftDeleted, assertNotSoftDeleted } from '@stacksjs/testing'

it('should soft delete user', async () => {
  const user = await User.create({ name: 'John' })
  await user.delete() // Soft delete

  await assertSoftDeleted('users', { id: user.id })
})

it('should restore user', async () => {
  const user = await User.create({ name: 'John' })
  await user.delete()
  await user.restore()

  await assertNotSoftDeleted('users', { id: user.id })
})
```

## DynamoDB Testing

### DynamoDB Assertions

```typescript
import { assertDynamoHas, assertDynamoMissing, assertDynamoCount } from '@stacksjs/testing'

it('should create item in DynamoDB', async () => {
  await dynamo.put({ pk: 'USER#1', sk: 'PROFILE', name: 'John' })

  await assertDynamoHas('users-table', {
    pk: 'USER#1',
    sk: 'PROFILE'
  })
})

it('should delete item', async () => {
  await dynamo.delete({ pk: 'USER#1', sk: 'PROFILE' })

  await assertDynamoMissing('users-table', {
    pk: 'USER#1',
    sk: 'PROFILE'
  })
})
```

## Feature Testing

### HTTP Testing

```typescript
import { describe, it, expect } from '@stacksjs/testing'

describe('API Routes', () => {
  it('should return users list', async () => {
    const response = await fetch('http://localhost:3000/api/users')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.users).toBeInstanceOf(Array)
  })

  it('should create user', async () => {
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John', email: 'john@test.com' })
    })

    expect(response.status).toBe(201)

    const data = await response.json()
    expect(data.user.name).toBe('John')
  })
})
```

### Authenticated Requests

```typescript
import { actingAs } from '@stacksjs/testing'

it('should access protected route', async () => {
  const user = await User.create({ name: 'John', email: 'john@test.com' })
  const token = await actingAs(user)

  const response = await fetch('http://localhost:3000/api/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  })

  expect(response.status).toBe(200)
})
```

## Factories

### Defining Factories

```typescript
// tests/factories/UserFactory.ts
import { Factory } from '@stacksjs/testing'
import { faker } from '@stacksjs/faker'

export const UserFactory = Factory.define(() => ({
  name: faker.person.fullName(),
  email: faker.internet.email(),
  password: faker.internet.password(),
  createdAt: faker.date.past()
}))
```

### Using Factories

```typescript
import { UserFactory, PostFactory } from 'tests/factories'

it('should create user with factory', async () => {
  // Create single record
  const user = await UserFactory.create()
  expect(user.id).toBeDefined()

  // Create multiple records
  const users = await UserFactory.createMany(5)
  expect(users).toHaveLength(5)

  // Create with overrides
  const admin = await UserFactory.create({
    role: 'admin',
    email: 'admin@test.com'
  })
  expect(admin.role).toBe('admin')
})
```

### Factory States

```typescript
export const UserFactory = Factory.define(() => ({
  name: faker.person.fullName(),
  email: faker.internet.email()
}))
  .state('admin', () => ({
    role: 'admin',
    permissions: ['all']
  }))
  .state('unverified', () => ({
    emailVerifiedAt: null
  }))

// Usage
const admin = await UserFactory.state('admin').create()
const unverified = await UserFactory.state('unverified').create()
```

### Factory Relationships

```typescript
export const PostFactory = Factory.define(() => ({
  title: faker.lorem.sentence(),
  content: faker.lorem.paragraphs()
}))
  .hasMany('comments', CommentFactory, 3)
  .belongsTo('author', UserFactory)

// Creates post with author and 3 comments
const post = await PostFactory.create()
```

## Mocking

### Mock Functions

```typescript
import { mock, spyOn } from '@stacksjs/testing'

it('should call function with correct args', () => {
  const mockFn = mock(() => 'result')

  const result = mockFn('arg1', 'arg2')

  expect(mockFn).toHaveBeenCalled()
  expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
  expect(mockFn).toHaveBeenCalledTimes(1)
  expect(result).toBe('result')
})
```

### Spy on Methods

```typescript
it('should spy on method', () => {
  const obj = {
    method: () => 'original'
  }

  const spy = spyOn(obj, 'method')
  obj.method()

  expect(spy).toHaveBeenCalled()
})
```

### Mock Return Values

```typescript
const mockFn = mock()
  .mockReturnValue('value')
  .mockReturnValueOnce('first call')
  .mockImplementation((x) => x * 2)

expect(mockFn(5)).toBe(10)
```

### Mock Modules

```typescript
import { mock } from '@stacksjs/testing'

// Mock entire module
mock.module('@stacksjs/email', () => ({
  send: mock(() => Promise.resolve({ sent: true }))
}))

// In test
it('should send email', async () => {
  const result = await sendWelcomeEmail('user@test.com')
  expect(result.sent).toBe(true)
})
```

## Time Testing

### Freezing Time

```typescript
import { freezeTime, travelTo } from '@stacksjs/testing'

it('should test time-dependent code', () => {
  // Freeze time
  freezeTime('2024-01-15 10:00:00')

  const now = new Date()
  expect(now.toISOString()).toBe('2024-01-15T10:00:00.000Z')

  // Travel to specific time
  travelTo(new Date('2024-06-01'))

  const future = new Date()
  expect(future.getMonth()).toBe(5) // June
})
```

## Test Utilities

### Skip and Only

```typescript
// Skip a test
it.skip('should be skipped', () => {
  // This test won't run
})

// Run only this test
it.only('should run only this', () => {
  // Only this test runs
})

// Skip describe block
describe.skip('Skipped Suite', () => {
  // All tests skipped
})
```

### Todo Tests

```typescript
it.todo('should implement this feature')
```

### Test Timeout

```typescript
it('should complete within timeout', async () => {
  await longRunningOperation()
}, 10000) // 10 second timeout
```

## Running Tests

### CLI Commands

```bash
# Run all tests
bun test

# Run specific file
bun test tests/user.test.ts

# Run tests matching pattern
bun test --filter "User"

# Watch mode
bun test --watch

# With coverage
bun test --coverage
```

### Configuration

```typescript
// bunfig.toml
[test]
# Glob patterns for test files
preload = ["./tests/setup.ts"]
timeout = 5000
coverage = true
coverageThreshold = {
  line = 80
  function = 80
  branch = 75
}
```

## Edge Cases

### Testing Async Errors

```typescript
it('should handle async errors', async () => {
  await expect(async () => {
    await failingAsyncFunction()
  }).rejects.toThrow('Expected error')
})
```

### Testing Event Emitters

```typescript
it('should emit event', async () => {
  const emitter = new EventEmitter()
  const handler = mock()

  emitter.on('event', handler)
  emitter.emit('event', { data: 'value' })

  expect(handler).toHaveBeenCalledWith({ data: 'value' })
})
```

### Testing Race Conditions

```typescript
it('should handle concurrent operations', async () => {
  const results = await Promise.all([
    incrementCounter(),
    incrementCounter(),
    incrementCounter()
  ])

  expect(await getCounter()).toBe(3)
})
```

## API Reference

### Test Functions

| Function | Description |
|----------|-------------|
| `describe(name, fn)` | Group tests |
| `it(name, fn, timeout?)` | Define test |
| `expect(value)` | Create assertion |
| `beforeAll(fn)` | Run before all tests |
| `beforeEach(fn)` | Run before each test |
| `afterEach(fn)` | Run after each test |
| `afterAll(fn)` | Run after all tests |

### Database Assertions

| Function | Description |
|----------|-------------|
| `assertDatabaseHas(table, data)` | Assert record exists |
| `assertDatabaseMissing(table, data)` | Assert record missing |
| `assertDatabaseCount(table, count)` | Assert row count |
| `assertSoftDeleted(table, data)` | Assert soft deleted |
| `assertNotSoftDeleted(table, data)` | Assert not soft deleted |

### Matchers

| Matcher | Description |
|---------|-------------|
| `toBe(value)` | Strict equality |
| `toEqual(value)` | Deep equality |
| `toBeTruthy()` | Truthy value |
| `toBeFalsy()` | Falsy value |
| `toBeNull()` | Is null |
| `toBeUndefined()` | Is undefined |
| `toBeDefined()` | Is defined |
| `toContain(item)` | Contains item |
| `toHaveLength(n)` | Has length n |
| `toThrow(msg?)` | Throws error |
| `toBeInstanceOf(class)` | Instance of class |
| `toHaveProperty(key)` | Has property |
| `toMatchObject(obj)` | Partial object match |

### Mock Functions

| Method | Description |
|--------|-------------|
| `mock(fn?)` | Create mock function |
| `spyOn(obj, method)` | Spy on method |
| `mockReturnValue(val)` | Set return value |
| `mockImplementation(fn)` | Set implementation |
| `toHaveBeenCalled()` | Was called |
| `toHaveBeenCalledWith(...args)` | Called with args |
| `toHaveBeenCalledTimes(n)` | Called n times |
