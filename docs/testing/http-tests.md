# HTTP Tests

HTTP tests verify your API endpoints respond correctly to requests. Stacks provides a fluent testing API for making requests and asserting responses.

## Overview

HTTP tests allow you to:

- **Test endpoints** - Verify routes return expected responses
- **Test authentication** - Ensure protected routes require auth
- **Test validation** - Confirm invalid input is rejected
- **Test integrations** - Test full request/response cycles

## Making Requests

### Basic Requests

```typescript
// tests/Feature/ApiTest.ts
import { describe, expect, it } from 'bun:test'
import { http } from '@stacksjs/testing'

describe('API', () => {
  it('returns users list', async () => {
    const response = await http.get('/api/users')

    expect(response.status).toBe(200)
    expect(response.json()).resolves.toHaveProperty('data')
  })

  it('creates a user', async () => {
    const response = await http.post('/api/users', {
      body: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.user.name).toBe('John Doe')
  })

  it('updates a user', async () => {
    const response = await http.put('/api/users/1', {
      body: { name: 'Jane Doe' },
    })

    expect(response.status).toBe(200)
  })

  it('deletes a user', async () => {
    const response = await http.delete('/api/users/1')

    expect(response.status).toBe(204)
  })
})
```

### Request Options

```typescript
import { http } from '@stacksjs/testing'

// With headers
const response = await http.get('/api/protected', {
  headers: {
    'Authorization': 'Bearer token123',
    'Accept': 'application/json',
  },
})

// With query parameters
const response = await http.get('/api/users', {
  query: {
    page: 1,
    limit: 10,
    sort: 'name',
  },
})

// With JSON body
const response = await http.post('/api/users', {
  body: {
    name: 'John',
    email: 'john@example.com',
  },
})

// With form data
const response = await http.post('/api/upload', {
  formData: {
    file: new File(['content'], 'test.txt'),
    description: 'Test file',
  },
})
```

## Response Assertions

### Status Assertions

```typescript
import { describe, expect, it } from 'bun:test'
import { http } from '@stacksjs/testing'

describe('Status codes', () => {
  it('returns 200 for successful request', async () => {
    const response = await http.get('/api/health')
    expect(response.status).toBe(200)
    expect(response.ok).toBe(true)
  })

  it('returns 201 for created resource', async () => {
    const response = await http.post('/api/posts', {
      body: { title: 'Test' },
    })
    expect(response.status).toBe(201)
  })

  it('returns 204 for no content', async () => {
    const response = await http.delete('/api/posts/1')
    expect(response.status).toBe(204)
  })

  it('returns 400 for bad request', async () => {
    const response = await http.post('/api/users', {
      body: {}, // Missing required fields
    })
    expect(response.status).toBe(400)
  })

  it('returns 401 for unauthorized', async () => {
    const response = await http.get('/api/admin')
    expect(response.status).toBe(401)
  })

  it('returns 404 for not found', async () => {
    const response = await http.get('/api/users/999999')
    expect(response.status).toBe(404)
  })
})
```

### JSON Response Assertions

```typescript
import { describe, expect, it } from 'bun:test'
import { http } from '@stacksjs/testing'

describe('JSON responses', () => {
  it('returns correct data structure', async () => {
    const response = await http.get('/api/users/1')
    const data = await response.json()

    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('name')
    expect(data).toHaveProperty('email')
    expect(data.id).toBe(1)
  })

  it('returns paginated list', async () => {
    const response = await http.get('/api/users')
    const data = await response.json()

    expect(data).toHaveProperty('data')
    expect(data).toHaveProperty('meta')
    expect(data.meta).toHaveProperty('currentPage')
    expect(data.meta).toHaveProperty('totalPages')
    expect(data.meta).toHaveProperty('totalItems')
    expect(Array.isArray(data.data)).toBe(true)
  })

  it('returns error format', async () => {
    const response = await http.post('/api/users', { body: {} })
    const data = await response.json()

    expect(data).toHaveProperty('error')
    expect(data).toHaveProperty('message')
  })
})
```

### Header Assertions

```typescript
import { describe, expect, it } from 'bun:test'
import { http } from '@stacksjs/testing'

describe('Response headers', () => {
  it('returns correct content type', async () => {
    const response = await http.get('/api/users')

    expect(response.headers.get('Content-Type'))
      .toContain('application/json')
  })

  it('includes CORS headers', async () => {
    const response = await http.get('/api/users')

    expect(response.headers.get('Access-Control-Allow-Origin'))
      .toBeDefined()
  })

  it('sets cache headers', async () => {
    const response = await http.get('/api/static-data')

    expect(response.headers.get('Cache-Control'))
      .toContain('max-age')
  })
})
```

## Authentication Testing

### Testing Protected Routes

```typescript
import { describe, expect, it } from 'bun:test'
import { http, actingAs } from '@stacksjs/testing'

describe('Protected routes', () => {
  it('rejects unauthenticated requests', async () => {
    const response = await http.get('/api/profile')

    expect(response.status).toBe(401)
  })

  it('accepts authenticated requests', async () => {
    const user = { id: 1, email: 'test@example.com' }

    const response = await actingAs(user).get('/api/profile')

    expect(response.status).toBe(200)
  })

  it('tests with bearer token', async () => {
    const token = 'valid-jwt-token'

    const response = await http.get('/api/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    expect(response.status).toBe(200)
  })
})
```

### Testing Authorization

```typescript
import { describe, expect, it } from 'bun:test'
import { actingAs } from '@stacksjs/testing'

describe('Authorization', () => {
  it('allows admin access', async () => {
    const admin = { id: 1, role: 'admin' }

    const response = await actingAs(admin).get('/api/admin/users')

    expect(response.status).toBe(200)
  })

  it('denies regular user access', async () => {
    const user = { id: 2, role: 'user' }

    const response = await actingAs(user).get('/api/admin/users')

    expect(response.status).toBe(403)
  })

  it('tests resource ownership', async () => {
    const owner = { id: 1 }
    const other = { id: 2 }

    // Owner can access their resource
    const ownerResponse = await actingAs(owner).get('/api/users/1/settings')
    expect(ownerResponse.status).toBe(200)

    // Others cannot
    const otherResponse = await actingAs(other).get('/api/users/1/settings')
    expect(otherResponse.status).toBe(403)
  })
})
```

## Validation Testing

### Testing Input Validation

```typescript
import { describe, expect, it } from 'bun:test'
import { http } from '@stacksjs/testing'

describe('User validation', () => {
  it('requires email', async () => {
    const response = await http.post('/api/users', {
      body: { name: 'John' }, // Missing email
    })

    expect(response.status).toBe(422)
    const data = await response.json()
    expect(data.errors.email).toContain('Email is required')
  })

  it('validates email format', async () => {
    const response = await http.post('/api/users', {
      body: {
        name: 'John',
        email: 'not-an-email',
      },
    })

    expect(response.status).toBe(422)
    const data = await response.json()
    expect(data.errors.email).toContain('Invalid email format')
  })

  it('requires password minimum length', async () => {
    const response = await http.post('/api/users', {
      body: {
        name: 'John',
        email: 'john@example.com',
        password: '123', // Too short
      },
    })

    expect(response.status).toBe(422)
    const data = await response.json()
    expect(data.errors.password).toContain('at least 8 characters')
  })

  it('accepts valid input', async () => {
    const response = await http.post('/api/users', {
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securepassword123',
      },
    })

    expect(response.status).toBe(201)
  })
})
```

### Testing Edge Cases

```typescript
import { describe, expect, it } from 'bun:test'
import { http } from '@stacksjs/testing'

describe('Edge cases', () => {
  it('handles empty body', async () => {
    const response = await http.post('/api/users', {
      body: null,
    })

    expect(response.status).toBe(400)
  })

  it('handles malformed JSON', async () => {
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid json }',
    })

    expect(response.status).toBe(400)
  })

  it('handles very long strings', async () => {
    const longString = 'a'.repeat(10000)

    const response = await http.post('/api/users', {
      body: {
        name: longString,
        email: 'test@example.com',
      },
    })

    expect(response.status).toBe(422)
    const data = await response.json()
    expect(data.errors.name).toContain('too long')
  })

  it('handles special characters', async () => {
    const response = await http.post('/api/users', {
      body: {
        name: 'Test <script>alert("xss")</script>',
        email: 'test@example.com',
      },
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    // Should be sanitized
    expect(data.user.name).not.toContain('<script>')
  })
})
```

## Database Integration

### Testing with Database

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { http } from '@stacksjs/testing'
import { db } from '@stacksjs/database'

describe('Users API with database', () => {
  beforeEach(async () => {
    // Seed test data
    await db.insertInto('users').values({
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
    }).execute()
  })

  afterEach(async () => {
    // Clean up
    await db.deleteFrom('users').execute()
  })

  it('lists users from database', async () => {
    const response = await http.get('/api/users')
    const data = await response.json()

    expect(data.data).toHaveLength(1)
    expect(data.data[0].email).toBe('test@example.com')
  })

  it('creates user in database', async () => {
    const response = await http.post('/api/users', {
      body: {
        name: 'New User',
        email: 'new@example.com',
      },
    })

    expect(response.status).toBe(201)

    // Verify in database
    const user = await db.selectFrom('users')
      .where('email', '=', 'new@example.com')
      .selectAll()
      .executeTakeFirst()

    expect(user).toBeDefined()
    expect(user?.name).toBe('New User')
  })
})
```

### Using Database Transactions

```typescript
import { describe, expect, it } from 'bun:test'
import { http, useTransaction } from '@stacksjs/testing'

describe('Transactional tests', () => {
  // Each test runs in a transaction that's rolled back
  useTransaction()

  it('creates user without persisting', async () => {
    const response = await http.post('/api/users', {
      body: {
        name: 'Temp User',
        email: 'temp@example.com',
      },
    })

    expect(response.status).toBe(201)
    // User exists during test but is rolled back after
  })
})
```

## Testing File Uploads

```typescript
import { describe, expect, it } from 'bun:test'
import { http } from '@stacksjs/testing'

describe('File uploads', () => {
  it('uploads image successfully', async () => {
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4E, 0x47])], // PNG header
      'test.png',
      { type: 'image/png' }
    )

    const response = await http.post('/api/upload', {
      formData: {
        image: file,
      },
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data).toHaveProperty('url')
  })

  it('rejects invalid file types', async () => {
    const file = new File(
      ['test content'],
      'malware.exe',
      { type: 'application/x-msdownload' }
    )

    const response = await http.post('/api/upload', {
      formData: {
        image: file,
      },
    })

    expect(response.status).toBe(422)
  })

  it('rejects oversized files', async () => {
    // Create a large file (5MB)
    const largeContent = new Uint8Array(5 * 1024 * 1024)
    const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' })

    const response = await http.post('/api/upload', {
      formData: {
        image: file,
      },
    })

    expect(response.status).toBe(422)
    const data = await response.json()
    expect(data.error).toContain('file size')
  })
})
```

## Testing Rate Limiting

```typescript
import { describe, expect, it } from 'bun:test'
import { http } from '@stacksjs/testing'

describe('Rate limiting', () => {
  it('allows requests under limit', async () => {
    for (let i = 0; i < 10; i++) {
      const response = await http.get('/api/limited')
      expect(response.status).toBe(200)
    }
  })

  it('blocks requests over limit', async () => {
    // Make many requests quickly
    const responses = await Promise.all(
      Array.from({ length: 100 }, () => http.get('/api/limited'))
    )

    const blocked = responses.filter(r => r.status === 429)
    expect(blocked.length).toBeGreaterThan(0)
  })

  it('returns retry-after header', async () => {
    // Exhaust rate limit
    for (let i = 0; i < 100; i++) {
      await http.get('/api/limited')
    }

    const response = await http.get('/api/limited')
    if (response.status === 429) {
      expect(response.headers.get('Retry-After')).toBeDefined()
    }
  })
})
```

## Running HTTP Tests

```bash
# Run all feature/HTTP tests
buddy test:feature

# Run specific test file
bun test tests/Feature/UserApiTest.ts

# Run with specific server
TEST_SERVER_URL=http://localhost:3000 bun test

# Run with coverage
buddy test:feature --coverage
```

## Best Practices

### DO

- **Test happy paths and error cases** - Both success and failure scenarios
- **Test authentication thoroughly** - Protected routes, token expiry, permissions
- **Clean up test data** - Use transactions or explicit cleanup
- **Test response structure** - Not just status codes, but data shape

### DON'T

- **Don't test external APIs** - Mock them instead
- **Don't rely on test order** - Each test should be independent
- **Don't hardcode IDs** - Use factories or dynamic data
- **Don't skip error handling** - Test all error responses

## Related Documentation

- **[Testing Overview](/testing/getting-started)** - Getting started with testing
- **[Unit Tests](/testing/unit-tests)** - Testing isolated functions
- **[Database Testing](/testing/database)** - Database test utilities
- **[Mocking](/testing/mocking)** - Mocking external services
