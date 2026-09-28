---
title: Application Testing
description: "Stacks provides a comprehensive testing framework built on Bun's native test runner. Write unit tests, integration tests, and component tests with excelle..."
---
# Testing

Stacks provides a comprehensive testing framework built on Bun's native test runner. Write unit tests, integration tests, and component tests with excellent developer experience.

## Overview

Testing in Stacks offers:

- **Fast execution** - Bun's native test runner is blazing fast
- **TypeScript support** - First-class TypeScript integration
- **Rich assertions** - Comprehensive assertion library
- **Database utilities** - Transaction rollback, factories
- **HTTP testing** - Test API endpoints easily
- **Component testing** - DOM tests in-process with very-happy-dom

## Quick Start

### Running Tests

```bash
# Run all tests
bun test

# Run specific file
bun test tests/Unit/UserTest.ts

# Run with pattern
bun test --grep "user registration"

# Run with coverage
bun test --coverage

# Watch mode
bun test --watch
```

## Writing Tests

### Basic Structure

```typescript
// tests/Unit/ExampleTest.ts
import { describe, expect, it, beforeEach, afterEach } from 'bun:test'

describe('Calculator', () => {
  let calculator: Calculator

  beforeEach(() => {
    calculator = new Calculator()
  })

  it('adds two numbers', () => {
    expect(calculator.add(2, 3)).toBe(5)
  })

  it('subtracts two numbers', () => {
    expect(calculator.subtract(5, 3)).toBe(2)
  })

  describe('division', () => {
    it('divides two numbers', () => {
      expect(calculator.divide(10, 2)).toBe(5)
    })

    it('throws on division by zero', () => {
      expect(() => calculator.divide(10, 0)).toThrow('Division by zero')
    })
  })
})
```

### Assertions

```typescript
import { expect } from 'bun:test'

// Equality
expect(value).toBe(expected)           // Strict equality
expect(value).toEqual(expected)        // Deep equality
expect(value).not.toBe(unexpected)     // Negation

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeDefined()

// Numbers
expect(value).toBeGreaterThan(3)
expect(value).toBeGreaterThanOrEqual(3)
expect(value).toBeLessThan(5)
expect(value).toBeLessThanOrEqual(5)
expect(value).toBeCloseTo(0.3, 5)

// Strings
expect(value).toContain('substring')
expect(value).toMatch(/pattern/)
expect(value).toHaveLength(5)

// Arrays
expect(array).toContain(item)
expect(array).toHaveLength(3)
expect(array).toEqual([1, 2, 3])

// Objects
expect(object).toHaveProperty('key')
expect(object).toHaveProperty('key', value)
expect(object).toMatchObject({ key: value })

// Errors
expect(() => fn()).toThrow()
expect(() => fn()).toThrow('message')
expect(() => fn()).toThrow(ErrorClass)

// Async
await expect(promise).resolves.toBe(value)
await expect(promise).rejects.toThrow()
```

## Test Organization

### Directory Structure

```
tests/
├── Unit/                 # Unit tests
│   ├── Models/
│   │   └── UserTest.ts
│   ├── Services/
│   │   └── PaymentServiceTest.ts
│   └── Utils/
│       └── StringTest.ts
├── Feature/              # Integration tests
│   ├── Auth/
│   │   └── LoginTest.ts
│   └── Api/
│       └── UsersTest.ts
├── browser/              # Component & DOM tests
│   └── checkout.test.ts
└── helpers/              # Test utilities
    └── index.ts
```

### Naming Conventions

- Test files: `*Test.ts` or `*.test.ts`
- Describe blocks: Feature or class name
- It blocks: Behavior description

## Unit Testing

### Testing Functions

```typescript
// src/utils/string.ts
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// tests/Unit/Utils/StringTest.ts
import { describe, expect, it } from 'bun:test'
import { capitalize } from '@/utils/string'

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  it('handles empty string', () => {
    expect(capitalize('')).toBe('')
  })

  it('handles already capitalized', () => {
    expect(capitalize('Hello')).toBe('Hello')
  })
})
```

### Testing Classes

```typescript
import { describe, expect, it, beforeEach } from 'bun:test'
import { UserService } from '@/services/UserService'
import { MockUserRepository } from '../mocks/MockUserRepository'

describe('UserService', () => {
  let service: UserService
  let mockRepo: MockUserRepository

  beforeEach(() => {
    mockRepo = new MockUserRepository()
    service = new UserService(mockRepo)
  })

  it('creates a user', async () => {
    const user = await service.create({
      name: 'John',
      email: 'john@example.com',
    })

    expect(user.id).toBeDefined()
    expect(user.name).toBe('John')
  })

  it('validates email format', async () => {
    await expect(service.create({
      name: 'John',
      email: 'invalid-email',
    })).rejects.toThrow('Invalid email')
  })
})
```

## Database Testing

### Transaction Rollback

```typescript
import { describe, it, expect } from 'bun:test'
import { useTransaction } from '@stacksjs/testing/database'
import { User } from '@/models/User'

describe('User Model', () => {
  useTransaction() // Rollback after each test

  it('creates user in database', async () => {
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
    })

    expect(user.id).toBeDefined()

    // User exists in DB
    const found = await User.find(user.id)
    expect(found).not.toBeNull()
  })

  // Database is rolled back - user no longer exists
})
```

### Factories

A factory is not a separate file. It is the `factory` you already declared on
each attribute of the model:

```typescript
// app/Models/User.ts
export default defineModel({
  name: 'User',
  attributes: {
    name: { fillable: true, factory: faker => faker.person.fullName() },
    email: { fillable: true, unique: true, factory: faker => faker.internet.email() },
    password: { fillable: true, factory: () => 'password' },
  },
})
```

`factory('User')` builds rows from those declarations - the same generator
`buddy seed` uses, so password columns are hashed, unique columns are kept
distinct across a batch, and relation columns are filled:

```typescript
import { factory, useTransaction } from '@stacksjs/testing/database'

describe('UserService', () => {
  useTransaction()

  it('finds user by email', async () => {
    const user = await factory('User').create({
      email: 'specific@example.com',
    })

    const found = await UserService.findByEmail('specific@example.com')
    expect(found?.id).toBe(user.id)
  })

  it('lists all users', async () => {
    await factory('User').createMany(5)

    const users = await UserService.all()
    expect(users).toHaveLength(5)
  })
})
```

`make()` and `makeMany(n)` are the same thing without the insert, for a test that
wants attributes rather than rows. There is no singular/plural mode switch:
`make` and `create` always return one row, `makeMany` and `createMany` always
return an array.

## HTTP Testing

### API Endpoints

```typescript
import { describe, expect, it } from 'bun:test'
import { http } from '@stacksjs/testing'
import { useTransaction } from '@stacksjs/testing/database'
import { factory } from '@stacksjs/testing/database'

describe('Users API', () => {
  useTransaction()

  it('lists users', async () => {
    await factory('User').createMany(3)

    const response = await http.get('/api/users')

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.users).toHaveLength(3)
  })

  it('creates a user', async () => {
    const response = await http.post('/api/users', {
      body: {
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
      },
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.user.email).toBe('new@example.com')
  })

  it('validates required fields', async () => {
    const response = await http.post('/api/users', {
      body: { name: 'Test' }, // Missing email and password
    })

    expect(response.status).toBe(422)
    const data = await response.json()
    expect(data.errors.email).toBeDefined()
    expect(data.errors.password).toBeDefined()
  })
})
```

### Authenticated Requests

```typescript
import { actingAs } from '@stacksjs/testing'

describe('Profile API', () => {
  useTransaction()

  it('gets current user profile', async () => {
    const user = await factory('User').create()

    const response = await actingAs(user).get('/api/profile')

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.user.id).toBe(user.id)
  })

  it('requires authentication', async () => {
    const response = await http.get('/api/profile')

    expect(response.status).toBe(401)
  })
})
```

## Mocking

### Function Mocks

```typescript
import { describe, expect, it, mock, spyOn } from 'bun:test'

describe('Mocking', () => {
  it('mocks a function', () => {
    const mockFn = mock(() => 'mocked')

    expect(mockFn()).toBe('mocked')
    expect(mockFn).toHaveBeenCalled()
  })

  it('spies on methods', () => {
    const service = new EmailService()
    const spy = spyOn(service, 'send').mockResolvedValue({ sent: true })

    await service.send('test@example.com', 'Hello')

    expect(spy).toHaveBeenCalledWith('test@example.com', 'Hello')
  })
})
```

### Module Mocks

```typescript
import { mock } from 'bun:test'

mock.module('@/services/stripe', () => ({
  charge: mock().mockResolvedValue({ success: true }),
}))

import { processPayment } from '@/services/payment'

it('processes payment', async () => {
  const result = await processPayment(100)
  expect(result.success).toBe(true)
})
```

## Component & DOM Testing

Component tests run under `bun test` against [very-happy-dom](https://github.com/stacksjs/very-happy-dom), a virtual DOM built for Bun. There is no browser and no server — you get `document`, `window` and the DOM APIs in-process, which makes these tests fast enough to run on every save.

### Setup

Register the browser globals once as a preload:

```toml
# bunfig.toml
[test]
preload = ["very-happy-dom/register"]
```

Or register them yourself when you want to pass options:

```typescript
// tests/setup.ts
import { GlobalRegistrator } from 'very-happy-dom'

GlobalRegistrator.register({ url: 'https://example.com/' })
```

### Writing a component test

Drive the DOM directly. `document` is the interface — there is no `page` object.

```typescript
// tests/browser/checkout.test.ts
import { beforeEach, describe, expect, it } from 'bun:test'
import { renderCheckout } from '../../resources/components/checkout'

describe('Checkout', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('submits the form with the entered details', () => {
    document.body.appendChild(renderCheckout())

    const email = document.querySelector<HTMLInputElement>('[name="email"]')!
    email.value = 'test@example.com'
    email.dispatchEvent(new Event('input', { bubbles: true }))

    let submitted: FormData | null = null
    document.querySelector('form')!.addEventListener('submit', (event) => {
      event.preventDefault()
      submitted = new FormData(event.target as HTMLFormElement)
    })

    document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()

    expect(submitted!.get('email')).toBe('test@example.com')
  })
})
```

Events bubble, `addEventListener` supports `once`/`capture`/`signal`, and `new FormData(form)` populates from the form's fields — so most testing-library patterns work unchanged.

### What this layer can and cannot assert

very-happy-dom implements the DOM, not a browser. It covers DOM structure and mutation, CSS selectors and XPath, events and focus, forms and constraint validation, storage, `fetch`, timers, observers, web components and Shadow DOM.

It deliberately does not implement four things, and tests must not assert on them:

- **Real navigation.** Nothing is fetched or loaded; assigning a URL does not load a document, and client-side routing does not run.
- **The CSS cascade.** `getComputedStyle()` reads inline styles only. A rule from a stylesheet — including any utility class — is not applied, so class-based style assertions will not reflect what a browser renders.
- **Layout.** `getBoundingClientRect()` reports the element's inline-style size at the origin. Positions, overlap, scroll offsets and element geometry are not computed.
- **Visibility and pixels.** Because there is no cascade and no layout, "is this visible?" cannot be answered here, and neither can anything about how the page actually looks.

Assertions that depend on those four belong in real-browser QA. Writing them against a virtual DOM produces tests that pass without checking anything — comparing `0` to `0` for a geometry check, for instance — which reads as coverage while providing none.

### Real-browser QA

For behaviour that needs a real engine — navigation, layout, visibility, screenshots — use the [`stacks-browse`](/skills/craft/browse) skill, which drives Chrome over the DevTools Protocol.

It is a QA and diagnosis tool rather than a test runner: it has no spec files, fixtures or reporters, and a scenario is expressed as CLI steps rather than as a committed test. Use it to verify a flow in a real browser, capture screenshots, or inspect console and network output. If you need real-browser behaviour gated in CI, reach for a dedicated browser-test runner in its own package, kept out of the application's dependency tree.

## Code Coverage

```bash
# Run with coverage
bun test --coverage

# Generate HTML report
bun test --coverage --coverage-reporter=html
```

### Coverage Thresholds

```typescript
// bunfig.toml
[test]
coverage = true
coverageThreshold = {
  lines = 80,
  functions = 80,
  branches = 70,
  statements = 80
}
```

## Best Practices

1. **Test behavior, not implementation** - Focus on what code does
2. **Use factories** - Consistent test data creation
3. **Isolate tests** - Each test should be independent
4. **Use transactions** - Automatic database cleanup
5. **Mock external services** - Don't make real API calls
6. **Keep tests fast** - Fast feedback loop
7. **Test edge cases** - Empty inputs, errors, boundaries

## Related

- [Unit Tests](/testing/unit-tests) - Unit testing guide
- [Feature Tests](/testing/feature-tests) - Integration testing
- [HTTP Tests](/testing/http-tests) - API testing
- [Mocking](/testing/mocking) - Mocking guide
- [Database Testing](/testing/database) - Database utilities
