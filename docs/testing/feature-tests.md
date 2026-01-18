# Feature Tests

Feature tests (also known as integration tests) verify that multiple parts of your application work together correctly. They test complete user workflows rather than isolated units.

## Overview

Feature tests help you:

- **Test workflows** - Complete user journeys like registration, checkout
- **Verify integration** - Database, cache, queue working together
- **Test business logic** - Complex operations across multiple services
- **Ensure correctness** - Full request/response cycles

## Writing Feature Tests

### Basic Structure

```typescript
// tests/Feature/UserRegistrationTest.ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { http, useTransaction } from '@stacksjs/testing'
import { db } from '@stacksjs/database'

describe('User Registration', () => {
  useTransaction()  // Rollback DB changes after each test

  it('registers a new user', async () => {
    const response = await http.post('/api/register', {
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        password_confirmation: 'password123',
      },
    })

    expect(response.status).toBe(201)

    const data = await response.json()
    expect(data.user.email).toBe('john@example.com')
    expect(data.token).toBeDefined()

    // Verify user exists in database
    const user = await db.selectFrom('users')
      .where('email', '=', 'john@example.com')
      .selectAll()
      .executeTakeFirst()

    expect(user).toBeDefined()
    expect(user?.name).toBe('John Doe')
  })

  it('validates required fields', async () => {
    const response = await http.post('/api/register', {
      body: {
        email: 'john@example.com',
        // Missing name and password
      },
    })

    expect(response.status).toBe(422)

    const data = await response.json()
    expect(data.errors.name).toBeDefined()
    expect(data.errors.password).toBeDefined()
  })

  it('prevents duplicate email registration', async () => {
    // Create existing user
    await db.insertInto('users').values({
      name: 'Existing User',
      email: 'john@example.com',
      password: 'hashed_password',
    }).execute()

    const response = await http.post('/api/register', {
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        password_confirmation: 'password123',
      },
    })

    expect(response.status).toBe(422)
    const data = await response.json()
    expect(data.errors.email).toContain('already taken')
  })
})
```

### Testing Complete Workflows

```typescript
// tests/Feature/CheckoutTest.ts
import { describe, expect, it } from 'bun:test'
import { actingAs, assertDatabaseHas, http, useTransaction } from '@stacksjs/testing'
import { UserFactory, ProductFactory } from '../factories'

describe('Checkout Flow', () => {
  useTransaction()

  it('completes a full checkout', async () => {
    // Setup: Create user and products
    const user = await UserFactory.create()
    const product = await ProductFactory.create({ price: 29.99, stock: 10 })

    // Step 1: Add to cart
    const addToCartResponse = await actingAs(user).post('/api/cart', {
      body: { product_id: product.id, quantity: 2 },
    })
    expect(addToCartResponse.status).toBe(200)

    // Step 2: Get cart summary
    const cartResponse = await actingAs(user).get('/api/cart')
    const cart = await cartResponse.json()
    expect(cart.items).toHaveLength(1)
    expect(cart.total).toBe(59.98)  // 29.99 * 2

    // Step 3: Submit order
    const orderResponse = await actingAs(user).post('/api/orders', {
      body: {
        shipping_address: {
          line1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zip: '10001',
        },
        payment_method: 'card_test_123',
      },
    })
    expect(orderResponse.status).toBe(201)

    const order = await orderResponse.json()
    expect(order.status).toBe('pending')
    expect(order.total).toBe(59.98)

    // Verify: Order exists in database
    await assertDatabaseHas('orders', {
      user_id: user.id,
      total: 59.98,
    })

    // Verify: Stock was decremented
    await assertDatabaseHas('products', {
      id: product.id,
      stock: 8,  // 10 - 2
    })

    // Verify: Cart was cleared
    const emptyCartResponse = await actingAs(user).get('/api/cart')
    const emptyCart = await emptyCartResponse.json()
    expect(emptyCart.items).toHaveLength(0)
  })
})
```

## Test Setup

### Using Factories

```typescript
// tests/factories/UserFactory.ts
import { Factory } from '@stacksjs/testing'
import { db } from '@stacksjs/database'

export const UserFactory = new Factory({
  definition() {
    return {
      name: this.faker.person.fullName(),
      email: this.faker.internet.email(),
      password: 'hashed_password',
      email_verified_at: new Date(),
    }
  },

  async create(attributes = {}) {
    const data = { ...this.make(), ...attributes }
    return db.insertInto('users')
      .values(data)
      .returning('*')
      .executeTakeFirstOrThrow()
  },

  states: {
    unverified() {
      return { email_verified_at: null }
    },
    admin() {
      return { role: 'admin' }
    },
  },
})
```

### Using Seeders

```typescript
// tests/Feature/DashboardTest.ts
import { beforeAll, describe, expect, it } from 'bun:test'
import { actingAs, http } from '@stacksjs/testing'
import { UserFactory, PostFactory } from '../factories'

describe('Dashboard', () => {
  let adminUser: User
  let posts: Post[]

  beforeAll(async () => {
    // Seed test data
    adminUser = await UserFactory.state('admin').create()
    posts = await PostFactory.createMany(10, { user_id: adminUser.id })
  })

  it('shows admin dashboard with stats', async () => {
    const response = await actingAs(adminUser).get('/api/admin/dashboard')

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.postCount).toBe(10)
    expect(data.recentPosts).toHaveLength(5)
  })
})
```

## Testing Authentication

### Login Flow

```typescript
describe('Authentication', () => {
  useTransaction()

  it('logs in with valid credentials', async () => {
    const user = await UserFactory.create({
      email: 'test@example.com',
      password: await hash('secret123'),
    })

    const response = await http.post('/api/login', {
      body: {
        email: 'test@example.com',
        password: 'secret123',
      },
    })

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.token).toBeDefined()
    expect(data.user.id).toBe(user.id)
  })

  it('fails with invalid credentials', async () => {
    await UserFactory.create({
      email: 'test@example.com',
      password: await hash('secret123'),
    })

    const response = await http.post('/api/login', {
      body: {
        email: 'test@example.com',
        password: 'wrong_password',
      },
    })

    expect(response.status).toBe(401)
  })

  it('returns user profile when authenticated', async () => {
    const user = await UserFactory.create()

    const response = await actingAs(user).get('/api/me')

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.id).toBe(user.id)
    expect(data.email).toBe(user.email)
  })
})
```

### Authorization Tests

```typescript
describe('Admin Access', () => {
  useTransaction()

  it('allows admins to access admin routes', async () => {
    const admin = await UserFactory.state('admin').create()

    const response = await actingAs(admin).get('/api/admin/users')

    expect(response.status).toBe(200)
  })

  it('denies regular users admin access', async () => {
    const user = await UserFactory.create()

    const response = await actingAs(user).get('/api/admin/users')

    expect(response.status).toBe(403)
  })

  it('denies unauthenticated access', async () => {
    const response = await http.get('/api/admin/users')

    expect(response.status).toBe(401)
  })
})
```

## Testing with External Services

### Mocking External APIs

```typescript
import { describe, expect, it, mock, spyOn } from 'bun:test'
import * as paymentService from '@/services/payment'

describe('Payment Processing', () => {
  useTransaction()

  it('processes payment successfully', async () => {
    const user = await UserFactory.create()

    // Mock external payment API
    spyOn(paymentService, 'chargeCard').mockResolvedValue({
      success: true,
      transactionId: 'txn_123',
    })

    const response = await actingAs(user).post('/api/orders', {
      body: {
        items: [{ product_id: 1, quantity: 1 }],
        card_token: 'tok_test',
      },
    })

    expect(response.status).toBe(201)

    const order = await response.json()
    expect(order.payment_status).toBe('paid')
    expect(order.transaction_id).toBe('txn_123')
  })

  it('handles payment failure gracefully', async () => {
    const user = await UserFactory.create()

    spyOn(paymentService, 'chargeCard').mockResolvedValue({
      success: false,
      error: 'Card declined',
    })

    const response = await actingAs(user).post('/api/orders', {
      body: {
        items: [{ product_id: 1, quantity: 1 }],
        card_token: 'tok_test',
      },
    })

    expect(response.status).toBe(422)

    const data = await response.json()
    expect(data.error).toContain('payment failed')
  })
})
```

### Testing Queue Jobs

```typescript
import { describe, expect, it } from 'bun:test'
import { fake, getFakeQueue, restore } from '@stacksjs/queue'

describe('Order Processing Jobs', () => {
  beforeEach(() => fake())
  afterEach(() => restore())

  it('dispatches email job after order', async () => {
    const user = await UserFactory.create()

    await actingAs(user).post('/api/orders', {
      body: { items: [{ product_id: 1, quantity: 1 }] },
    })

    const fakeQueue = getFakeQueue()

    expect(fakeQueue.hasDispatched('SendOrderConfirmation')).toBe(true)

    const jobs = fakeQueue.dispatched('SendOrderConfirmation')
    expect(jobs[0].data.userId).toBe(user.id)
  })

  it('dispatches inventory update job', async () => {
    const user = await UserFactory.create()

    await actingAs(user).post('/api/orders', {
      body: { items: [{ product_id: 1, quantity: 2 }] },
    })

    const fakeQueue = getFakeQueue()

    expect(fakeQueue.hasDispatched('UpdateInventory')).toBe(true)

    const jobs = fakeQueue.dispatched('UpdateInventory')
    expect(jobs[0].data.productId).toBe(1)
    expect(jobs[0].data.quantity).toBe(2)
  })
})
```

## Testing Events

```typescript
import { describe, expect, it } from 'bun:test'
import { eventFake, getDispatchedEvents } from '@stacksjs/testing'

describe('User Events', () => {
  beforeEach(() => eventFake())

  it('fires UserRegistered event', async () => {
    await http.post('/api/register', {
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        password_confirmation: 'password123',
      },
    })

    const events = getDispatchedEvents('UserRegistered')
    expect(events).toHaveLength(1)
    expect(events[0].payload.email).toBe('john@example.com')
  })
})
```

## Running Feature Tests

```bash
# Run all feature tests
buddy test:feature

# Run specific test file
bun test tests/Feature/CheckoutTest.ts

# Run tests matching pattern
bun test --grep "checkout"

# Run with coverage
buddy test:feature --coverage

# Watch mode
buddy test:feature --watch
```

## Best Practices

### DO

- **Test complete workflows** - Not just individual endpoints
- **Use factories** - Create test data consistently
- **Use transactions** - Isolate database changes per test
- **Test error cases** - Invalid input, unauthorized access, failures
- **Mock external services** - Don't call real payment APIs

### DON'T

- **Don't test implementation details** - Test behavior, not code
- **Don't share state between tests** - Each test should be independent
- **Don't rely on specific data** - Use factories, not hardcoded IDs
- **Don't skip cleanup** - Always rollback database changes

## Related Documentation

- **[Testing Overview](/testing/getting-started)** - Getting started with testing
- **[Unit Tests](/testing/unit-tests)** - Testing isolated functions
- **[HTTP Tests](/testing/http-tests)** - Testing API endpoints
- **[Database Testing](/testing/database)** - Database test utilities
- **[Mocking](/testing/mocking)** - Mocking dependencies
