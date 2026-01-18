---
title: Actions
description: Learn how to create and use Actions in Stacks applications
---

# Actions

Actions are the primary way to handle business logic in Stacks applications. They encapsulate request handling, validation, and response formatting in a clean, reusable structure. Actions follow a Laravel-inspired pattern while leveraging TypeScript's type safety.

## Introduction

Actions replace traditional controllers for most use cases, providing:
- Single-responsibility request handlers
- Built-in request validation
- Type-safe request/response handling
- Composable and reusable logic
- Queue job integration
- Rate limiting configuration

Actions are stored in `app/Actions/` and can be organized into subdirectories.

## Creating Actions

### Basic Action Structure

```typescript
// app/Actions/HelloAction.ts
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Hello Action',
  description: 'Returns a hello message',
  method: 'GET',

  async handle() {
    return response.json({
      message: 'Hello, World!',
    })
  },
})
```

### Action with Request Handling

```typescript
// app/Actions/User/CreateUserAction.ts
import type { Request } from '@stacksjs/router'
import { Action } from '@stacksjs/actions'
import { User } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'Create User',
  description: 'Creates a new user account',
  method: 'POST',

  validations: {
    name: {
      rule: schema.string().min(2).max(100),
      message: {
        min: 'Name must be at least 2 characters',
        max: 'Name cannot exceed 100 characters',
      },
    },
    email: {
      rule: schema.string().email(),
      message: 'Please provide a valid email address',
    },
    password: {
      rule: schema.string().min(8),
      message: {
        min: 'Password must be at least 8 characters',
      },
    },
  },

  async handle(request: Request) {
    const user = await User.create({
      name: request.get('name'),
      email: request.get('email'),
      password: await hash(request.get('password')),
    })

    return response.json({
      message: 'User created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
  },
})
```

## Action Options

### Complete Options Interface

```typescript
interface ActionOptions {
  // Identification
  name?: string                    // Display name
  description?: string             // Description for documentation

  // HTTP Configuration
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path?: string                    // Route path (optional)

  // Validation
  validations?: ActionValidations  // Input validation rules

  // Queue/Job Configuration
  rate?: string                    // Cron schedule (e.g., '* * * * *')
  tries?: number                   // Retry attempts (default: 3)
  backoff?: number                 // Backoff delay in seconds
  enabled?: boolean                // Enable/disable the action

  // Model binding
  model?: string                   // Associated model name

  // Handler
  handle: (request?: Request) => Promise<any> | any
}
```

### Example with All Options

```typescript
import { Action } from '@stacksjs/actions'
import { Every } from '@stacksjs/types'

export default new Action({
  name: 'Process Payment',
  description: 'Processes a payment transaction',
  method: 'POST',
  path: '/payments/process',
  model: 'Payment',

  // Retry configuration for queued execution
  tries: 5,
  backoff: 10,
  rate: Every.Hour,
  enabled: true,

  validations: {
    amount: {
      rule: schema.number().min(1),
      message: 'Amount must be at least 1',
    },
    currency: {
      rule: schema.enum(['USD', 'EUR', 'GBP']),
      message: 'Invalid currency',
    },
  },

  async handle(request) {
    // Payment processing logic
  },
})
```

## Request Handling

### Accessing Request Data

The `request` object provides Laravel-style helper methods:

```typescript
async handle(request: Request) {
  // Get single value with optional default
  const name = request.get('name', 'Anonymous')
  const email = request.get<string>('email')

  // Get all input data
  const allData = request.all()

  // Get specific keys only
  const credentials = request.only<{ email: string; password: string }>([
    'email',
    'password',
  ])

  // Get all except specific keys
  const dataWithoutPassword = request.except<{ name: string; email: string }>([
    'password',
  ])

  // Check if key exists
  if (request.has('remember')) {
    // ...
  }

  // Check if multiple keys exist
  if (request.has(['email', 'password'])) {
    // ...
  }

  // Check if any of the keys exist
  if (request.hasAny(['email', 'username'])) {
    // ...
  }

  // Check if key exists and is not empty
  if (request.filled('name')) {
    // ...
  }

  // Check if key is missing
  if (request.missing('optional_field')) {
    // ...
  }
}
```

### Type-Safe Input Methods

```typescript
async handle(request: Request) {
  // String input
  const title = request.string('title', '')

  // Integer input
  const page = request.integer('page', 1)

  // Float input
  const price = request.float('price', 0.0)

  // Boolean input
  const active = request.boolean('active', false)

  // Array input
  const tags = request.array<string>('tags')
}
```

### Route Parameters

Access route parameters:

```typescript
// Route: /users/{id}/posts/{postId}
async handle(request: Request) {
  const userId = request.params.id
  const postId = request.params.postId

  // Or using get method
  const id = request.get('id')
}
```

### File Uploads

Handle file uploads:

```typescript
async handle(request: Request) {
  // Get single file
  const avatar = request.file('avatar')

  if (avatar) {
    // Store file
    const path = await avatar.store('avatars')

    // Store with custom name
    const customPath = await avatar.storeAs('avatars', 'custom-name.jpg')

    // Get file properties
    console.log(avatar.name)      // Original filename
    console.log(avatar.size)      // File size in bytes
    console.log(avatar.type)      // MIME type
  }

  // Check if file exists
  if (request.hasFile('document')) {
    const document = request.file('document')
  }

  // Get multiple files
  const images = request.getFiles('images')
  for (const image of images) {
    await image.store('gallery')
  }

  // Get all files
  const allFiles = request.allFiles()
}
```

### Authentication

Access authenticated user:

```typescript
async handle(request: Request) {
  // Get authenticated user (set by auth middleware)
  const user = await request.user()

  if (!user) {
    return response.unauthorized('Please log in')
  }

  // Get current access token
  const token = await request.userToken()

  // Check token abilities
  if (await request.tokenCan('posts:create')) {
    // User can create posts
  }

  if (await request.tokenCant('admin')) {
    return response.forbidden('Admin access required')
  }
}
```

## Validation

### Defining Validation Rules

```typescript
import { schema } from '@stacksjs/validation'

export default new Action({
  validations: {
    // String validation
    name: {
      rule: schema.string().min(2).max(100),
      message: {
        min: 'Name is too short',
        max: 'Name is too long',
      },
    },

    // Email validation
    email: {
      rule: schema.string().email(),
      message: 'Invalid email address',
    },

    // Number validation
    age: {
      rule: schema.number().min(18).max(120),
      message: {
        min: 'Must be at least 18',
        max: 'Invalid age',
      },
    },

    // Enum validation
    status: {
      rule: schema.enum(['active', 'inactive', 'pending']),
      message: 'Invalid status value',
    },

    // Boolean validation
    acceptTerms: {
      rule: schema.boolean(),
      message: 'You must accept the terms',
    },

    // Optional field
    nickname: {
      rule: schema.string().optional(),
    },
  },

  async handle(request) {
    // Validation runs automatically before handle()
    // If validation fails, returns 422 with errors
  },
})
```

### Validation Response

When validation fails, the action returns a 422 response:

```json
{
  "error": "Validation failed",
  "errors": {
    "email": ["Invalid email address"],
    "password": ["Password must be at least 8 characters"]
  }
}
```

## Response Helpers

### JSON Response

```typescript
import { response } from '@stacksjs/router'

async handle(request) {
  // Success response
  return response.json({
    success: true,
    data: { id: 1, name: 'John' },
  })

  // With status code
  return response.json({ created: true }, 201)
}
```

### Text Response

```typescript
async handle() {
  return response.text('Hello, World!')
}
```

### Error Responses

```typescript
import { response } from '@stacksjs/router'

async handle(request) {
  // 401 Unauthorized
  return response.unauthorized('Please log in')

  // 403 Forbidden
  return response.forbidden('Access denied')

  // 404 Not Found
  return response.notFound('Resource not found')

  // 422 Validation Error
  return response.validationError({
    email: ['Email is required'],
  })

  // 500 Server Error
  return response.serverError('Something went wrong')
}
```

### Custom Response

```typescript
async handle() {
  return new Response(JSON.stringify({ custom: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Custom-Header': 'value',
    },
  })
}
```

## Action Composition

### Calling Other Actions

```typescript
import { runAction } from '@stacksjs/actions'

export default new Action({
  name: 'Create Order',

  async handle(request) {
    // Create the order
    const order = await Order.create(request.all())

    // Run another action
    await runAction('SendOrderConfirmation', { orderId: order.id })

    // Or import and call directly
    const notifyAction = await import('./NotifyCustomerAction')
    await notifyAction.default.handle({ customerId: order.customerId })

    return response.json({ order })
  },
})
```

### Shared Logic

Extract shared logic into helper functions:

```typescript
// app/Actions/helpers/validation.ts
export async function validateUser(userId: number): Promise<User | null> {
  const user = await User.find(userId)
  if (!user) {
    throw new HttpError(404, 'User not found')
  }
  return user
}

// app/Actions/User/UpdateUserAction.ts
import { validateUser } from '../helpers/validation'

export default new Action({
  async handle(request) {
    const user = await validateUser(request.params.id)
    await user.update(request.all())
    return response.json({ user })
  },
})
```

## Dependency Injection

### Using Services

```typescript
import { Action } from '@stacksjs/actions'
import { PaymentService } from '@/services/PaymentService'
import { EmailService } from '@/services/EmailService'

export default new Action({
  name: 'Process Payment',

  async handle(request) {
    const paymentService = new PaymentService()
    const emailService = new EmailService()

    const payment = await paymentService.process({
      amount: request.get('amount'),
      currency: request.get('currency'),
    })

    await emailService.sendReceipt(payment)

    return response.json({ payment })
  },
})
```

### Configuration Access

```typescript
import { config } from '@stacksjs/config'

export default new Action({
  async handle() {
    const apiKey = config.services.stripe.key
    const appName = config.app.name

    // Use configuration
  },
})
```

## Async Actions

### Long-Running Operations

```typescript
export default new Action({
  name: 'Generate Report',

  async handle(request) {
    // Start async operation
    const reportId = await Report.create({
      status: 'processing',
      userId: request.get('userId'),
    })

    // Dispatch to queue for background processing
    await job('GenerateReport', { reportId }).dispatch()

    // Return immediately
    return response.json({
      message: 'Report generation started',
      reportId,
    })
  },
})
```

### Streaming Responses

```typescript
export default new Action({
  name: 'Stream Data',

  async handle(request) {
    const stream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < 100; i++) {
          controller.enqueue(`data: ${JSON.stringify({ count: i })}\n\n`)
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  },
})
```

## Action Middleware

### Route-Level Middleware

Apply middleware when routing to an action:

```typescript
// routes/api.ts
route.post('/admin/settings', 'Actions/Admin/UpdateSettingsAction')
  .middleware('auth')
  .middleware('abilities:admin')
```

### Action-Based Authorization

Check permissions within the action:

```typescript
export default new Action({
  async handle(request) {
    const user = await request.user()

    if (!user) {
      return response.unauthorized()
    }

    if (!await request.tokenCan('settings:update')) {
      return response.forbidden('Missing required permission')
    }

    // Proceed with action
  },
})
```

## Error Handling

### Throwing HTTP Errors

```typescript
import { HttpError } from '@stacksjs/error-handling'

export default new Action({
  async handle(request) {
    const user = await User.find(request.params.id)

    if (!user) {
      throw new HttpError(404, 'User not found')
    }

    if (user.isDeleted) {
      throw new HttpError(410, 'User has been deleted')
    }

    return response.json({ user })
  },
})
```

### Try-Catch Pattern

```typescript
import { handleError } from '@stacksjs/error-handling'

export default new Action({
  async handle(request) {
    try {
      const result = await riskyOperation()
      return response.json({ result })
    } catch (error) {
      handleError(error)
      return response.serverError('Operation failed')
    }
  },
})
```

## Edge Cases and Gotchas

### Request Body Consumption

The request body can only be read once. Stacks handles this automatically, but be aware when using raw request methods:

```typescript
async handle(request) {
  // Use request.all() or request.get() instead of request.json()
  const data = request.all()

  // Don't do this:
  // const body = await request.json() // May fail if already consumed
}
```

### Async Validation

Validation runs synchronously before `handle()`. For async validation (like uniqueness checks), validate within the handler:

```typescript
async handle(request) {
  const email = request.get('email')

  // Async uniqueness check
  const existing = await User.where('email', email).first()
  if (existing) {
    return response.validationError({
      email: ['Email already in use'],
    })
  }

  // Proceed with creation
}
```

### File Upload Limits

Configure file upload limits in your server configuration:

```typescript
// config/server.ts
export default {
  maxRequestBodySize: 50 * 1024 * 1024, // 50MB
}
```

## API Reference

### Action Class

```typescript
class Action {
  constructor(options: ActionOptions)

  name?: string
  description?: string
  method?: string
  path?: string
  validations?: ActionValidations
  rate?: string
  tries?: number
  backoff?: number
  enabled?: boolean
  model?: string
  handle: (request?: Request) => Promise<any> | any
}
```

### Request Methods

| Method | Description |
|--------|-------------|
| `get(key, default?)` | Get input value |
| `all()` | Get all input |
| `only(keys)` | Get specific keys |
| `except(keys)` | Exclude specific keys |
| `has(key)` | Check key exists |
| `hasAny(keys)` | Check any key exists |
| `filled(key)` | Check key is not empty |
| `missing(key)` | Check key is missing |
| `string(key, default?)` | Get as string |
| `integer(key, default?)` | Get as integer |
| `float(key, default?)` | Get as float |
| `boolean(key, default?)` | Get as boolean |
| `array(key)` | Get as array |
| `file(key)` | Get uploaded file |
| `hasFile(key)` | Check file exists |
| `user()` | Get authenticated user |
| `tokenCan(ability)` | Check token ability |

## Related Documentation

- [Routing](/basics/routing) - Route to action mapping
- [Middleware](/basics/middleware) - Request middleware
- [Validation](/packages/validation) - Validation rules
- [Jobs](/basics/jobs) - Background job processing
- [Error Handling](/basics/error-handling) - Error handling
