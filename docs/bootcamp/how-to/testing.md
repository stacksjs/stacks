# Testing

This guide covers testing strategies and patterns for your Stacks application, including unit tests, integration tests, and test-driven development (TDD).

## Getting Started

Stacks uses Bun's built-in test runner for fast and efficient testing.

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test tests/user.test.ts

# Run tests matching pattern
bun test --grep "user"
```

## Test Structure

### Basic Test

```ts
// tests/unit/utils.test.ts
import { describe, it, expect } from 'bun:test'
import { formatCurrency, formatDate } from '@/utils/formatters'

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1000, 'USD')).toBe('$10.00')
  })

  it('formats EUR correctly', () => {
    expect(formatCurrency(1000, 'EUR')).toBe('€10.00')
  })

  it('handles zero', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00')
  })

  it('handles negative values', () => {
    expect(formatCurrency(-1000, 'USD')).toBe('-$10.00')
  })
})

describe('formatDate', () => {
  it('formats dates correctly', () => {
    const date = new Date('2024-01-15')
    expect(formatDate(date)).toBe('January 15, 2024')
  })

  it('formats with custom format', () => {
    const date = new Date('2024-01-15')
    expect(formatDate(date, 'MM/DD/YYYY')).toBe('01/15/2024')
  })
})
```

### Test Hooks

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test'

describe('Database Tests', () => {
  beforeAll(async () => {
    // Run once before all tests
    await setupTestDatabase()
  })

  afterAll(async () => {
    // Run once after all tests
    await teardownTestDatabase()
  })

  beforeEach(async () => {
    // Run before each test
    await beginTransaction()
  })

  afterEach(async () => {
    // Run after each test
    await rollbackTransaction()
  })

  it('creates a user', async () => {
    const user = await User.create({ name: 'Test', email: 'test@example.com' })
    expect(user.id).toBeDefined()
  })
})
```

## Unit Testing

### Testing Functions

```ts
// tests/unit/validators.test.ts
import { describe, it, expect } from 'bun:test'
import { validateEmail, validatePassword, validatePhone } from '@/utils/validators'

describe('validateEmail', () => {
  it('returns true for valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true)
    expect(validateEmail('user.name@example.co.uk')).toBe(true)
  })

  it('returns false for invalid emails', () => {
    expect(validateEmail('invalid')).toBe(false)
    expect(validateEmail('missing@domain')).toBe(false)
    expect(validateEmail('@nodomain.com')).toBe(false)
  })
})

describe('validatePassword', () => {
  it('validates minimum length', () => {
    expect(validatePassword('short')).toEqual({
      valid: false,
      errors: ['Password must be at least 8 characters'],
    })
  })

  it('validates complexity requirements', () => {
    expect(validatePassword('password123')).toEqual({
      valid: false,
      errors: ['Password must contain an uppercase letter'],
    })
  })

  it('accepts valid passwords', () => {
    expect(validatePassword('SecurePass123!')).toEqual({
      valid: true,
      errors: [],
    })
  })
})
```

### Testing Classes

```ts
// tests/unit/cart.test.ts
import { describe, it, expect, beforeEach } from 'bun:test'
import { Cart } from '@/services/Cart'

describe('Cart', () => {
  let cart: Cart

  beforeEach(() => {
    cart = new Cart()
  })

  describe('addItem', () => {
    it('adds item to empty cart', () => {
      cart.addItem({ id: 1, name: 'Product', price: 1000 })
      expect(cart.items).toHaveLength(1)
      expect(cart.items[0].id).toBe(1)
    })

    it('increases quantity for existing item', () => {
      cart.addItem({ id: 1, name: 'Product', price: 1000 })
      cart.addItem({ id: 1, name: 'Product', price: 1000 })
      expect(cart.items).toHaveLength(1)
      expect(cart.items[0].quantity).toBe(2)
    })
  })

  describe('removeItem', () => {
    it('removes item from cart', () => {
      cart.addItem({ id: 1, name: 'Product', price: 1000 })
      cart.removeItem(1)
      expect(cart.items).toHaveLength(0)
    })

    it('does nothing for non-existent item', () => {
      cart.addItem({ id: 1, name: 'Product', price: 1000 })
      cart.removeItem(999)
      expect(cart.items).toHaveLength(1)
    })
  })

  describe('total', () => {
    it('calculates total correctly', () => {
      cart.addItem({ id: 1, name: 'Product A', price: 1000 })
      cart.addItem({ id: 2, name: 'Product B', price: 2000 })
      expect(cart.total).toBe(3000)
    })

    it('returns 0 for empty cart', () => {
      expect(cart.total).toBe(0)
    })
  })
})
```

## Integration Testing

### Testing API Endpoints

```ts
// tests/integration/api/users.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { app } from '@/app'

describe('Users API', () => {
  let testUser: any
  let authToken: string

  beforeAll(async () => {
    // Create test user and get token
    const response = await app.request('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      }),
    })
    const data = await response.json()
    testUser = data.user
    authToken = data.token
  })

  afterAll(async () => {
    // Cleanup
    await User.where('email', '=', 'test@example.com').delete()
  })

  describe('GET /api/users', () => {
    it('returns users list with authentication', async () => {
      const response = await app.request('/api/users', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(Array.isArray(data.users)).toBe(true)
    })

    it('returns 401 without authentication', async () => {
      const response = await app.request('/api/users')
      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/users/:id', () => {
    it('returns user details', async () => {
      const response = await app.request(`/api/users/${testUser.id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.user.email).toBe('test@example.com')
    })

    it('returns 404 for non-existent user', async () => {
      const response = await app.request('/api/users/99999', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })

      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /api/users/:id', () => {
    it('updates user profile', async () => {
      const response = await app.request(`/api/users/${testUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.user.name).toBe('Updated Name')
    })
  })
})
```

### Testing Database Operations

```ts
// tests/integration/database/user.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { db } from '@stacksjs/database'
import { User } from '@stacksjs/orm'

describe('User Model', () => {
  beforeEach(async () => {
    await db.transaction().execute(async (trx) => {
      // Tests will run in this transaction
    })
  })

  afterEach(async () => {
    // Cleanup test data
    await User.where('email', 'like', '%@test.com').delete()
  })

  describe('create', () => {
    it('creates user with valid data', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'create@test.com',
        password: 'hashedpassword',
      })

      expect(user.id).toBeDefined()
      expect(user.name).toBe('Test User')
      expect(user.email).toBe('create@test.com')
    })

    it('throws on duplicate email', async () => {
      await User.create({
        name: 'First User',
        email: 'duplicate@test.com',
        password: 'password',
      })

      await expect(
        User.create({
          name: 'Second User',
          email: 'duplicate@test.com',
          password: 'password',
        })
      ).rejects.toThrow()
    })
  })

  describe('relationships', () => {
    it('loads user orders', async () => {
      const user = await User.create({
        name: 'Order User',
        email: 'orders@test.com',
        password: 'password',
      })

      await Order.create({ user_id: user.id, total: 1000 })
      await Order.create({ user_id: user.id, total: 2000 })

      const userWithOrders = await User.with(['orders']).find(user.id)
      expect(userWithOrders?.orders).toHaveLength(2)
    })
  })
})
```

## Mocking

### Mocking Functions

```ts
import { describe, it, expect, mock, spyOn } from 'bun:test'
import { sendEmail } from '@/services/email'
import { UserService } from '@/services/UserService'

describe('UserService', () => {
  it('sends welcome email on registration', async () => {
    const mockSendEmail = mock(() => Promise.resolve())

    // Replace the actual function
    const originalSendEmail = sendEmail
    global.sendEmail = mockSendEmail

    const userService = new UserService()
    await userService.register({
      name: 'Test',
      email: 'test@example.com',
      password: 'password',
    })

    expect(mockSendEmail).toHaveBeenCalled()
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        template: 'welcome',
      })
    )

    // Restore
    global.sendEmail = originalSendEmail
  })
})
```

### Mocking HTTP Requests

```ts
import { describe, it, expect, mock } from 'bun:test'
import { PaymentService } from '@/services/PaymentService'

describe('PaymentService', () => {
  it('processes payment successfully', async () => {
    // Mock fetch
    const mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 'ch_123',
          status: 'succeeded',
        }),
      })
    )
    global.fetch = mockFetch

    const paymentService = new PaymentService()
    const result = await paymentService.charge(1000, 'tok_visa')

    expect(result.status).toBe('succeeded')
    expect(mockFetch).toHaveBeenCalled()
  })

  it('handles payment failure', async () => {
    const mockFetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 402,
        json: () => Promise.resolve({
          error: { message: 'Card declined' },
        }),
      })
    )
    global.fetch = mockFetch

    const paymentService = new PaymentService()

    await expect(
      paymentService.charge(1000, 'tok_declined')
    ).rejects.toThrow('Card declined')
  })
})
```

## Test-Driven Development (TDD)

### TDD Workflow

1. **Write a failing test**
2. **Write minimal code to pass**
3. **Refactor**

### Example: Building a Feature with TDD

```ts
// Step 1: Write failing test
// tests/unit/discount.test.ts
import { describe, it, expect } from 'bun:test'
import { calculateDiscount } from '@/services/discount'

describe('calculateDiscount', () => {
  it('applies percentage discount', () => {
    expect(calculateDiscount(10000, { type: 'percentage', value: 10 })).toBe(9000)
  })

  it('applies fixed discount', () => {
    expect(calculateDiscount(10000, { type: 'fixed', value: 1500 })).toBe(8500)
  })

  it('does not go below zero', () => {
    expect(calculateDiscount(1000, { type: 'fixed', value: 2000 })).toBe(0)
  })

  it('handles no discount', () => {
    expect(calculateDiscount(10000, null)).toBe(10000)
  })
})
```

```ts
// Step 2: Write minimal code
// src/services/discount.ts
interface Discount {
  type: 'percentage' | 'fixed'
  value: number
}

export function calculateDiscount(
  amount: number,
  discount: Discount | null
): number {
  if (!discount) return amount

  let discountAmount = 0

  if (discount.type === 'percentage') {
    discountAmount = Math.floor(amount * (discount.value / 100))
  } else {
    discountAmount = discount.value
  }

  return Math.max(0, amount - discountAmount)
}
```

```ts
// Step 3: Refactor and add more tests
describe('calculateDiscount - edge cases', () => {
  it('handles zero amount', () => {
    expect(calculateDiscount(0, { type: 'percentage', value: 10 })).toBe(0)
  })

  it('handles 100% discount', () => {
    expect(calculateDiscount(10000, { type: 'percentage', value: 100 })).toBe(0)
  })
})
```

## Test Configuration

### bun.test.ts

```ts
// bun.test.ts
import { beforeAll, afterAll } from 'bun:test'

// Global setup
beforeAll(async () => {
  // Set test environment
  process.env.APP_ENV = 'testing'

  // Initialize test database
  await setupTestDatabase()
})

// Global teardown
afterAll(async () => {
  await cleanupTestDatabase()
})
```

### Test Environment

```env
# .env.testing
APP_ENV=testing
APP_DEBUG=true

DB_CONNECTION=sqlite
DB_DATABASE=:memory:

MAIL_MAILER=log
CACHE_DRIVER=array
```

## Coverage Reports

```bash
# Generate coverage report
bun test --coverage

# Output coverage to specific directory
bun test --coverage --coverage-dir=./coverage
```

## Best Practices

1. **Keep tests focused** - One assertion per test when possible
2. **Use descriptive names** - Test names should describe behavior
3. **Arrange-Act-Assert** - Structure tests clearly
4. **Isolate tests** - Tests should not depend on each other
5. **Test edge cases** - Include boundary conditions
6. **Mock external services** - Don't make real API calls
7. **Use factories** - Create test data consistently

```ts
// Good: Descriptive, focused test
describe('User Registration', () => {
  it('creates user with hashed password', async () => {
    // Arrange
    const userData = { email: 'test@example.com', password: 'plain123' }

    // Act
    const user = await registerUser(userData)

    // Assert
    expect(user.password).not.toBe('plain123')
    expect(await verifyPassword('plain123', user.password)).toBe(true)
  })
})
```

This documentation covers testing strategies and patterns for Stacks applications. Each example is designed for reliable and maintainable tests.
