# Unit Tests

Unit tests verify individual functions, classes, and modules work correctly in isolation. Stacks provides a streamlined unit testing experience built on Bun's native test runner.

## Overview

Unit tests focus on:

- **Isolated testing** - Test functions without external dependencies
- **Fast feedback** - Quick execution for rapid development
- **Edge cases** - Verify behavior at boundaries
- **Regression prevention** - Ensure bugs stay fixed

## Writing Unit Tests

### Basic Structure

```typescript
// tests/Unit/StringsTest.ts
import { describe, expect, it } from 'bun:test'
import { slugify, capitalize, truncate } from '@stacksjs/strings'

describe('String Utilities', () => {
  describe('slugify', () => {
    it('converts spaces to hyphens', () => {
      expect(slugify('hello world')).toBe('hello-world')
    })

    it('converts to lowercase', () => {
      expect(slugify('Hello World')).toBe('hello-world')
    })

    it('removes special characters', () => {
      expect(slugify('Hello! World?')).toBe('hello-world')
    })

    it('handles empty strings', () => {
      expect(slugify('')).toBe('')
    })
  })

  describe('capitalize', () => {
    it('capitalizes first letter', () => {
      expect(capitalize('hello')).toBe('Hello')
    })

    it('handles single character', () => {
      expect(capitalize('h')).toBe('H')
    })
  })
})
```

### Testing Classes

```typescript
// tests/Unit/CartTest.ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { Cart, CartItem } from '@/Services/Cart'

describe('Cart', () => {
  let cart: Cart

  beforeEach(() => {
    cart = new Cart()
  })

  afterEach(() => {
    cart.clear()
  })

  describe('addItem', () => {
    it('adds item to cart', () => {
      const item: CartItem = { id: 1, name: 'Product', price: 10, quantity: 1 }
      cart.addItem(item)

      expect(cart.items).toHaveLength(1)
      expect(cart.items[0]).toEqual(item)
    })

    it('increments quantity for existing item', () => {
      const item: CartItem = { id: 1, name: 'Product', price: 10, quantity: 1 }
      cart.addItem(item)
      cart.addItem(item)

      expect(cart.items).toHaveLength(1)
      expect(cart.items[0].quantity).toBe(2)
    })
  })

  describe('total', () => {
    it('calculates total correctly', () => {
      cart.addItem({ id: 1, name: 'A', price: 10, quantity: 2 })
      cart.addItem({ id: 2, name: 'B', price: 5, quantity: 3 })

      expect(cart.total).toBe(35) // (10 * 2) + (5 * 3)
    })

    it('returns 0 for empty cart', () => {
      expect(cart.total).toBe(0)
    })
  })

  describe('removeItem', () => {
    it('removes item by id', () => {
      cart.addItem({ id: 1, name: 'A', price: 10, quantity: 1 })
      cart.addItem({ id: 2, name: 'B', price: 5, quantity: 1 })

      cart.removeItem(1)

      expect(cart.items).toHaveLength(1)
      expect(cart.items[0].id).toBe(2)
    })

    it('does nothing for non-existent item', () => {
      cart.addItem({ id: 1, name: 'A', price: 10, quantity: 1 })

      cart.removeItem(999)

      expect(cart.items).toHaveLength(1)
    })
  })
})
```

### Testing Async Functions

```typescript
// tests/Unit/ValidatorTest.ts
import { describe, expect, it } from 'bun:test'
import { validateEmail, validateAsync } from '@/Services/Validator'

describe('Validator', () => {
  describe('validateEmail', () => {
    it('validates correct email', () => {
      expect(validateEmail('user@example.com')).toBe(true)
    })

    it('rejects invalid email', () => {
      expect(validateEmail('invalid')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
      expect(validateEmail('@example.com')).toBe(false)
    })
  })

  describe('validateAsync', () => {
    it('resolves with valid data', async () => {
      const result = await validateAsync({ email: 'user@example.com' })
      expect(result.valid).toBe(true)
    })

    it('rejects with invalid data', async () => {
      const result = await validateAsync({ email: 'invalid' })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid email format')
    })
  })
})
```

## Testing Patterns

### Testing Pure Functions

Pure functions are easiest to test - same input always produces same output:

```typescript
import { describe, expect, it } from 'bun:test'
import { add, multiply, divide } from '@/Utils/Math'

describe('Math utilities', () => {
  it('adds numbers correctly', () => {
    expect(add(2, 3)).toBe(5)
    expect(add(-1, 1)).toBe(0)
    expect(add(0, 0)).toBe(0)
  })

  it('multiplies numbers correctly', () => {
    expect(multiply(3, 4)).toBe(12)
    expect(multiply(-2, 3)).toBe(-6)
    expect(multiply(0, 100)).toBe(0)
  })

  it('divides numbers correctly', () => {
    expect(divide(10, 2)).toBe(5)
    expect(divide(7, 2)).toBe(3.5)
  })

  it('throws on division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero')
  })
})
```

### Testing with Result Types

```typescript
import { describe, expect, it } from 'bun:test'
import { parseJSON, type Result } from '@stacksjs/utils'

describe('parseJSON', () => {
  it('returns Ok for valid JSON', () => {
    const result = parseJSON('{"name": "John"}')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toEqual({ name: 'John' })
    }
  })

  it('returns Err for invalid JSON', () => {
    const result = parseJSON('invalid json')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toContain('Unexpected token')
    }
  })
})
```

### Testing Error Cases

```typescript
import { describe, expect, it } from 'bun:test'
import { User } from '@/Models/User'

describe('User', () => {
  describe('constructor', () => {
    it('throws for invalid email', () => {
      expect(() => new User({ email: 'invalid', name: 'Test' }))
        .toThrow('Invalid email')
    })

    it('throws for empty name', () => {
      expect(() => new User({ email: 'test@example.com', name: '' }))
        .toThrow('Name is required')
    })
  })

  describe('setPassword', () => {
    it('throws for weak password', () => {
      const user = new User({ email: 'test@example.com', name: 'Test' })

      expect(() => user.setPassword('123'))
        .toThrow('Password must be at least 8 characters')
    })
  })
})
```

### Parameterized Tests

Test multiple inputs with the same logic:

```typescript
import { describe, expect, it } from 'bun:test'
import { isValidAge } from '@/Utils/Validation'

describe('isValidAge', () => {
  const validAges = [0, 18, 50, 120]
  const invalidAges = [-1, -100, 121, 200, NaN]

  validAges.forEach((age) => {
    it(`accepts ${age} as valid`, () => {
      expect(isValidAge(age)).toBe(true)
    })
  })

  invalidAges.forEach((age) => {
    it(`rejects ${age} as invalid`, () => {
      expect(isValidAge(age)).toBe(false)
    })
  })
})
```

## Mocking

### Mocking Functions

```typescript
import { describe, expect, it, mock, spyOn } from 'bun:test'
import { sendNotification } from '@/Services/Notification'
import * as emailService from '@/Services/Email'

describe('sendNotification', () => {
  it('sends email notification', async () => {
    const sendEmailMock = spyOn(emailService, 'sendEmail')
      .mockResolvedValue({ sent: true })

    await sendNotification('user@example.com', 'Hello!')

    expect(sendEmailMock).toHaveBeenCalledWith(
      'user@example.com',
      'Hello!'
    )
  })

  it('handles email failure gracefully', async () => {
    spyOn(emailService, 'sendEmail')
      .mockRejectedValue(new Error('SMTP error'))

    const result = await sendNotification('user@example.com', 'Hello!')

    expect(result.success).toBe(false)
    expect(result.error).toBe('SMTP error')
  })
})
```

### Mocking Modules

```typescript
import { describe, expect, it, mock } from 'bun:test'

// Mock the entire module
mock.module('@/Services/Database', () => ({
  query: mock(() => Promise.resolve([{ id: 1, name: 'Test' }])),
  insert: mock(() => Promise.resolve({ id: 1 })),
}))

import { UserRepository } from '@/Repositories/UserRepository'

describe('UserRepository', () => {
  it('finds users from database', async () => {
    const repo = new UserRepository()
    const users = await repo.findAll()

    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Test')
  })
})
```

### Mocking Time

```typescript
import { afterEach, beforeEach, describe, expect, it, setSystemTime } from 'bun:test'
import { isExpired, getTimeUntilExpiry } from '@/Utils/Token'

describe('Token utilities', () => {
  beforeEach(() => {
    setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    setSystemTime()  // Reset to real time
  })

  it('detects expired tokens', () => {
    const expiry = new Date('2024-01-15T11:00:00Z')  // 1 hour ago
    expect(isExpired(expiry)).toBe(true)
  })

  it('detects valid tokens', () => {
    const expiry = new Date('2024-01-15T13:00:00Z')  // 1 hour from now
    expect(isExpired(expiry)).toBe(false)
  })

  it('calculates time until expiry', () => {
    const expiry = new Date('2024-01-15T12:30:00Z')  // 30 minutes from now
    expect(getTimeUntilExpiry(expiry)).toBe(30 * 60 * 1000)  // 30 minutes in ms
  })
})
```

## Test Organization

### Grouping Related Tests

```typescript
describe('OrderService', () => {
  describe('creation', () => {
    it('creates order with valid data', () => { /* ... */ })
    it('validates required fields', () => { /* ... */ })
    it('generates unique order number', () => { /* ... */ })
  })

  describe('pricing', () => {
    it('calculates subtotal correctly', () => { /* ... */ })
    it('applies discount codes', () => { /* ... */ })
    it('calculates tax', () => { /* ... */ })
    it('calculates shipping', () => { /* ... */ })
  })

  describe('status transitions', () => {
    it('transitions from pending to confirmed', () => { /* ... */ })
    it('prevents invalid transitions', () => { /* ... */ })
    it('records transition history', () => { /* ... */ })
  })
})
```

### Shared Setup with Factories

```typescript
// tests/factories/UserFactory.ts
export function createUser(overrides = {}) {
  return {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    ...overrides,
  }
}

export function createAdmin(overrides = {}) {
  return createUser({
    role: 'admin',
    permissions: ['read', 'write', 'delete'],
    ...overrides,
  })
}

// tests/Unit/PermissionTest.ts
import { describe, expect, it } from 'bun:test'
import { createAdmin, createUser } from '../factories/UserFactory'
import { canDelete } from '@/Services/Permission'

describe('Permission', () => {
  it('allows admin to delete', () => {
    const admin = createAdmin()
    expect(canDelete(admin)).toBe(true)
  })

  it('denies regular user deletion', () => {
    const user = createUser()
    expect(canDelete(user)).toBe(false)
  })
})
```

## Running Unit Tests

```bash
# Run all unit tests
buddy test:unit

# Run specific test file
bun test tests/Unit/CartTest.ts

# Run tests matching pattern
bun test --grep "calculates total"

# Run with coverage
buddy test:unit --coverage

# Watch mode
buddy test:unit --watch
```

## Best Practices

### DO

- **Test one thing per test** - Each test should verify a single behavior
- **Use descriptive names** - Test names should describe expected behavior
- **Test edge cases** - Empty strings, null values, boundary conditions
- **Keep tests fast** - Unit tests should run in milliseconds
- **Use factories** - Create test data consistently

### DON'T

- **Don't test implementation** - Test behavior, not internal details
- **Don't share state** - Each test should be independent
- **Don't test external dependencies** - Mock them instead
- **Don't write fragile tests** - Tests shouldn't break on minor changes

## Related Documentation

- **[Testing Overview](/testing/getting-started)** - Getting started with testing
- **[HTTP Tests](/testing/http-tests)** - Testing API endpoints
- **[Mocking](/testing/mocking)** - Advanced mocking techniques
- **[Database Testing](/testing/database)** - Database test utilities
