---
title: Model-View-Action
description: "Stacks follows the Model-View-Action (MVA) architectural pattern, a modern evolution of MVC that emphasizes explicit business logic through Actions and pro..."
---
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

## Why MVA

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

Everything a model needs - schema, validation, factory, relationships, behavior -
is declared in one `defineModel()` call. Migrations are generated from it.

```typescript
// app/Models/User.ts
import { defineModel } from '@stacksjs/orm'
import { makeHash } from '@stacksjs/security'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'User',
  table: 'users',

  traits: {
    useAuth: { usePasskey: true },
    useUuid: true,
    useTimestamps: true,
    useSeeder: { count: 10 },
  },

  hasOne: ['Profile'],
  hasMany: ['Post', 'Order'],

  attributes: {
    name: {
      required: true,
      fillable: true,
      validation: { rule: schema.string().max(255) },
      factory: faker => faker.person.fullName(),
    },
    email: {
      required: true,
      unique: true,
      fillable: true,
      validation: { rule: schema.string().email() },
      factory: faker => faker.internet.email(),
    },
    password: {
      required: true,
      hidden: true,
      validation: { rule: schema.string().min(8) },
      factory: faker => faker.internet.password(),
    },
  },

  // Computed properties, derived on read
  get: {
    isVerified: model => model.emailVerifiedAt !== null,
  },

  // Transformed on write
  set: {
    password: value => makeHash(value),
  },

  // Reusable query constraints
  scopes: {
    verified: query => query.whereNotNull('email_verified_at'),
  },
} as const)
```

`hidden` keeps a value out of JSON serialization. `fillable` is what mass
assignment is allowed to touch - note that `password` is neither, so it can only
be set explicitly.

### Model Responsibilities

Models should only handle:

- Field definitions
- Relationships
- Scopes and queries
- Computed properties (derived from data)
- Simple data mutations

## Views

Views handle the presentation layer - rendering HTML, components, or JSON responses.

### stx components

```html
<!-- resources/views/users/profile.stx -->
<script server>
import { defineProps } from 'stx'

const { user } = defineProps<{ user: { name: string, email: string } }>()
</script>

<template>
  <div class="flex flex-col gap-4">
    <Avatar user="{{ user }}" size="large" />
    <h1 class="text-2xl">{{ user.name }}</h1>
    <p class="text-neutral-500">{{ user.email }}</p>
  </div>
</template>
```

Components under `resources/components/` resolve by name - `<Avatar />` needs no
import. See [stx](/basics/views) for directives, signals, and layouts.

### JSON responses

An action returns data; the router serializes it.

```typescript
// app/Actions/UserShowAction.ts
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'UserShowAction',
  description: 'Returns a single user',

  async handle(request) {
    const user = await User.findOrFail(request.getParam('id'))

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      verified: user.isVerified,
      joined: user.created_at,
    }
  },
})
```

Route params are always strings. Use `Number(...)` or `request.getParamAsInt()`
when you need a number.

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

Routes point at an action by path - there is no controller layer in between.

```typescript
// routes/api.ts
import { route } from '@stacksjs/router'

route.post('/orders', 'Actions/CreateOrderAction')
```

Actions compose by importing each other:

```typescript
// app/Actions/CheckoutAction.ts
import { Action } from '@stacksjs/actions'
import ApplyDiscountsAction from './ApplyDiscountsAction'
import ValidateCartAction from './ValidateCartAction'

export default new Action({
  name: 'CheckoutAction',
  description: 'Validates a cart, applies discounts, and places the order',

  async handle(request) {
    const cart = await ValidateCartAction.handle(request)
    const discounted = await ApplyDiscountsAction.handle(cart)

    return CreateOrderAction.handle(discounted)
  },
})
```

## Putting It Together

Here is a complete request, end to end:

```typescript
// 1. Route — points straight at the action
// routes/api.ts
route.post('/orders', 'Actions/CreateOrderAction')

// 2. Action — validates, then does the work
// app/Actions/CreateOrderAction.ts
export default new Action({
  name: 'CreateOrderAction',
  description: 'Places an order for the authenticated customer',

  validations: {
    items: { rule: schema.array().min(1) },
    paymentMethod: { rule: schema.string() },
  },

  async handle(request) {
    const order = await Order.create({
      customer_id: request.user.id,
      status: 'pending',
    })

    for (const item of request.get('items'))
      await DecrementStockAction.handle(item)

    // 3. Shape the response
    return {
      id: order.id,
      total: order.totalAmount,
      status: order.status,
    }
  },
})

// 4. Model — data only
// app/Models/Order.ts
export default defineModel({
  name: 'Order',
  traits: { useTimestamps: true, observe: true },
  belongsTo: ['Customer'],
  hasMany: ['OrderItem'],
  attributes: { /* … */ },
} as const)
```

`observe: true` on the model emits `order:created`, which listeners registered
in `app/Events.ts` pick up - so notifications and side effects stay out of the
action.

## Best Practices

1. **Routes stay declarative** - a route names an action and its middleware, nothing more
2. **Single responsibility** - each action does one thing well
3. **Name actions clearly** - use verb phrases: `CreateOrder`, `SendEmail`, `ProcessPayment`
4. **Compose actions** - build complex workflows from simple ones
5. **Test actions directly** - call `handle()` in a test rather than going through HTTP
6. **Push side effects to listeners** - `observe: true` plus `app/Events.ts` keeps
   notifications and audit trails out of the action's main path

## Related

- [Models](/basics/models) - Working with models
- [Controllers](/basics/actions) - HTTP controllers
- [Actions](/basics/actions) - Creating actions
- [Testing](/guide/testing) - Testing your code
