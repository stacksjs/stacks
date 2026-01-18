# Model-View-Action

Stacks follows the Model-View-Action (MVA) architectural pattern, a modern evolution of MVC that emphasizes explicit business logic through Actions and provides better testability and code organization.

## Overview

The MVA pattern separates your application into three main components:

- **Models** - Data structures and database interactions
- **Views** - User interface components
- **Actions** - Business logic and operations

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  View   │────▶│ Action  │────▶│  Model  │
│(Request)│     │ (Logic) │     │  (Data) │
└─────────┘     └─────────┘     └─────────┘
     ▲               │
     └───────────────┘
        (Response)
```

## Why MVA?

### Problems with Traditional MVC

In traditional MVC, controllers often become "fat" with business logic:

```typescript
// Traditional MVC - Fat Controller (avoid this)
class UserController {
  async register(request: Request) {
    // Validation
    const data = await request.validate(...)

    // Business logic mixed with HTTP handling
    const existingUser = await User.findByEmail(data.email)
    if (existingUser) {
      throw new Error('Email already exists')
    }

    // Password hashing
    data.password = await hash(data.password)

    // Create user
    const user = await User.create(data)

    // Send welcome email
    await Mailer.send('welcome', user.email, { user })

    // Create default settings
    await UserSettings.create({ user_id: user.id })

    // Log the registration
    await AuditLog.create({ action: 'user.registered', user_id: user.id })

    return this.json(user)
  }
}
```

### The MVA Solution

Actions extract business logic into dedicated, testable classes:

```typescript
// MVA - Thin Controller
class UserController {
  async register(request: Request) {
    const data = await request.validate(RegisterUserRequest)
    const user = await RegisterUserAction.run(data)
    return this.json(user, 201)
  }
}

// Dedicated Action
class RegisterUserAction extends Action {
  async handle(data: RegisterUserData) {
    // Check for existing user
    if (await User.findByEmail(data.email)) {
      throw new UserAlreadyExistsError()
    }

    // Create user with hashed password
    const user = await User.create({
      ...data,
      password: await hash(data.password),
    })

    // Dispatch follow-up actions
    await CreateUserSettingsAction.run(user)
    await SendWelcomeEmailAction.run(user)
    await LogUserRegistrationAction.run(user)

    return user
  }
}
```

## Models

Models represent your data and handle database interactions.

### Defining Models

```typescript
// app/Models/User.ts
import { Model, field, hasMany, hasOne } from '@stacksjs/orm'

export default class User extends Model {
  static table = 'users'

  static fields = {
    id: field.id(),
    name: field.string(),
    email: field.string().unique(),
    password: field.string().hidden(),
    email_verified_at: field.timestamp().nullable(),
    created_at: field.timestamp(),
    updated_at: field.timestamp(),
  }

  static relationships = {
    posts: hasMany(Post),
    profile: hasOne(Profile),
    orders: hasMany(Order),
  }

  // Computed properties
  get isVerified(): boolean {
    return this.email_verified_at !== null
  }

  // Model methods (data-related only)
  async markAsVerified(): Promise<void> {
    this.email_verified_at = new Date()
    await this.save()
  }
}
```

### Model Responsibilities

Models should only handle:

- Field definitions
- Relationships
- Scopes and queries
- Computed properties (derived from data)
- Simple data mutations

## Views

Views handle the presentation layer - rendering HTML, components, or JSON responses.

### Vue Components

```vue
<!-- views/users/Profile.vue -->
<template>
  <div class="profile">
    <Avatar :user="user" size="large" />
    <h1>{{ user.name }}</h1>
    <p>{{ user.email }}</p>

    <Button @click="editProfile">Edit Profile</Button>
  </div>
</template>

<script setup lang="ts">
import type { User } from '@/models/User'

const props = defineProps<{
  user: User
}>()

const emit = defineEmits<{
  edit: []
}>()

function editProfile() {
  emit('edit')
}
</script>
```

### API Responses

```typescript
// app/Controllers/UserController.ts
class UserController extends Controller {
  async show(request: Request) {
    const user = await User.findOrFail(request.params.id)

    // View: JSON response with resource transformation
    return UserResource.make(user)
  }
}

// app/Resources/UserResource.ts
class UserResource extends Resource {
  toArray() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      avatar: this.avatar_url,
      verified: this.isVerified,
      joined: this.created_at.toISOString(),
    }
  }
}
```

## Actions

Actions encapsulate business logic in dedicated, single-purpose classes.

### Creating Actions

```bash
buddy make:action CreateOrderAction
```

```typescript
// app/Actions/CreateOrderAction.ts
import { Action } from '@stacksjs/actions'

export class CreateOrderAction extends Action {
  constructor(
    private user: User,
    private items: CartItem[],
    private paymentMethod: PaymentMethod,
  ) {
    super()
  }

  async handle(): Promise<Order> {
    // Validate items are in stock
    await this.validateStock()

    // Calculate totals
    const totals = await this.calculateTotals()

    // Create order
    const order = await Order.create({
      user_id: this.user.id,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      status: 'pending',
    })

    // Create order items
    await this.createOrderItems(order)

    // Process payment
    await ProcessPaymentAction.run(order, this.paymentMethod)

    // Send confirmation
    OrderConfirmationEmail.dispatch(order)

    // Dispatch event
    OrderCreatedEvent.dispatch(order)

    return order
  }

  private async validateStock(): Promise<void> {
    for (const item of this.items) {
      const product = await Product.find(item.product_id)
      if (product.stock < item.quantity) {
        throw new InsufficientStockError(product)
      }
    }
  }

  private async calculateTotals() {
    const subtotal = this.items.reduce((sum, item) => {
      return sum + item.price * item.quantity
    }, 0)

    const tax = await TaxCalculator.calculate(subtotal, this.user.address)

    return {
      subtotal,
      tax,
      total: subtotal + tax,
    }
  }

  private async createOrderItems(order: Order): Promise<void> {
    for (const item of this.items) {
      await OrderItem.create({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
      })

      // Decrement stock
      await DecrementStockAction.run(item.product_id, item.quantity)
    }
  }
}
```

### Running Actions

```typescript
// From controllers
class OrderController extends Controller {
  async store(request: Request) {
    const { items, payment_method } = await request.validate(CreateOrderRequest)

    const order = await CreateOrderAction.run(
      request.user,
      items,
      payment_method,
    )

    return this.json(order, 201)
  }
}

// From other actions
class CheckoutAction extends Action {
  async handle() {
    // Validate cart
    const cart = await ValidateCartAction.run(this.user)

    // Apply discounts
    const discountedCart = await ApplyDiscountsAction.run(cart, this.coupon)

    // Create order
    return CreateOrderAction.run(this.user, discountedCart.items, this.payment)
  }
}

// From jobs
class ProcessBulkOrdersJob extends Job {
  async handle() {
    for (const orderData of this.orders) {
      await CreateOrderAction.run(orderData.user, orderData.items, orderData.payment)
    }
  }
}
```

### Action Composition

Actions can call other actions for complex workflows:

```typescript
class RegisterUserAction extends Action {
  async handle(data: RegisterData): Promise<User> {
    // Step 1: Create the user
    const user = await CreateUserAction.run(data)

    // Step 2: Set up user preferences
    await CreateUserPreferencesAction.run(user)

    // Step 3: Send verification email
    await SendVerificationEmailAction.run(user)

    // Step 4: Track analytics
    await TrackUserRegistrationAction.run(user, data.referrer)

    return user
  }
}
```

### Testing Actions

Actions are highly testable because they're isolated:

```typescript
import { describe, it, expect } from 'bun:test'
import { CreateOrderAction } from '@/actions/CreateOrderAction'
import { UserFactory, ProductFactory } from '@/factories'

describe('CreateOrderAction', () => {
  it('creates an order with items', async () => {
    const user = await UserFactory.create()
    const product = await ProductFactory.create({ stock: 10, price: 100 })

    const items = [{ product_id: product.id, quantity: 2, price: 100 }]
    const payment = { method: 'card', token: 'tok_visa' }

    const order = await CreateOrderAction.run(user, items, payment)

    expect(order.user_id).toBe(user.id)
    expect(order.total).toBe(200 + order.tax)
    expect(order.items).toHaveLength(1)
  })

  it('throws when insufficient stock', async () => {
    const user = await UserFactory.create()
    const product = await ProductFactory.create({ stock: 1 })

    const items = [{ product_id: product.id, quantity: 5, price: 100 }]

    await expect(CreateOrderAction.run(user, items, {}))
      .rejects.toThrow(InsufficientStockError)
  })
})
```

## Putting It Together

Here's how MVA works in a complete request:

```typescript
// 1. Route definition
router.post('/orders', OrderController.store)

// 2. Controller (thin - just delegates)
class OrderController extends Controller {
  async store(request: Request) {
    // Validate request
    const data = await request.validate(CreateOrderRequest)

    // Delegate to action
    const order = await CreateOrderAction.run(
      request.user,
      data.items,
      data.payment_method,
    )

    // Return view (JSON response)
    return OrderResource.make(order)
  }
}

// 3. Action (all business logic)
class CreateOrderAction extends Action {
  async handle() {
    // Complex business logic here
    // Calls other actions as needed
    // Returns model instance
  }
}

// 4. Model (data only)
class Order extends Model {
  // Field definitions
  // Relationships
  // Simple computed properties
}

// 5. Resource (view transformation)
class OrderResource extends Resource {
  toArray() {
    return {
      id: this.id,
      items: OrderItemResource.collection(this.items),
      total: this.formatted_total,
      status: this.status,
    }
  }
}
```

## Best Practices

1. **Keep controllers thin** - Controllers should only handle HTTP concerns
2. **Single responsibility** - Each action does one thing well
3. **Name actions clearly** - Use verb phrases: `CreateOrder`, `SendEmail`, `ProcessPayment`
4. **Compose actions** - Build complex workflows from simple actions
5. **Test actions directly** - Don't test business logic through HTTP
6. **Use dependency injection** - Pass dependencies through constructors

## Related

- [Models](/basics/models) - Working with models
- [Controllers](/basics/controllers) - HTTP controllers
- [Actions](/basics/actions) - Creating actions
- [Testing](/guide/testing) - Testing your code
