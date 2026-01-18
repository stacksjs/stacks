# Test Command

The `buddy test` command runs your test suite, including unit tests, feature tests, and type checking, powered by Bun's built-in test runner.

## Basic Usage

```bash
# Run all tests
buddy test

# Run specific test type
buddy test:unit
buddy test:feature
```

## Command Syntax

```bash
buddy test [options]
buddy test:unit [options]
buddy test:feature [options]
buddy test:ui [options]
buddy test:types [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-f, --feature` | Run feature tests |
| `-u, --unit` | Run unit tests |
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

## Available Test Commands

### All Tests

Run the complete test suite:

```bash
buddy test
```

### Unit Tests

Run only unit tests:

```bash
buddy test:unit
```

### Feature Tests

Run only feature/integration tests:

```bash
buddy test:feature
```

### UI Tests

Run tests in the browser (Vitest UI):

```bash
buddy test:ui
```

### Type Checking

Run TypeScript type checking:

```bash
buddy test:types
# or
buddy typecheck
```

## Examples

### Run All Tests

```bash
buddy test
```

Output:
```
buddy test

Running tests...

 PASS  tests/unit/utils.test.ts
 PASS  tests/unit/helpers.test.ts
 PASS  tests/feature/auth.test.ts

Tests: 3 passed, 3 total
Time:  2.34s

Finished running tests

Completed in 2.45s
```

### Run Unit Tests Only

```bash
buddy test:unit
```

### Run Feature Tests Only

```bash
buddy test:feature
```

### Run Both Specific Types

```bash
buddy test --unit --feature
```

### Type Check

```bash
buddy test:types
```

Output:
```
buddy test:types

Running typecheck...

No type errors found

Finished running typecheck

Completed in 4.56s
```

## Test File Structure

Stacks follows a conventional test structure:

```
tests/
├── unit/
│   ├── utils.test.ts
│   ├── helpers.test.ts
│   └── components/
│       └── Button.test.ts
├── feature/
│   ├── auth.test.ts
│   ├── api.test.ts
│   └── user-flow.test.ts
└── setup.ts
```

## Writing Tests

### Unit Test Example

```typescript
// tests/unit/utils.test.ts
import { describe, expect, it } from 'bun:test'
import { formatCurrency } from '@/utils'

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56')
  })

  it('handles zero', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00')
  })

  it('handles negative numbers', () => {
    expect(formatCurrency(-100, 'USD')).toBe('-$100.00')
  })
})
```

### Feature Test Example

```typescript
// tests/feature/auth.test.ts
import { describe, expect, it } from 'bun:test'
import { createTestClient } from '@stacksjs/testing'

describe('Authentication', () => {
  const client = createTestClient()

  it('can login with valid credentials', async () => {
    const response = await client.post('/api/auth/login', {
      email: 'user@example.com',
      password: 'password',
    })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('token')
  })

  it('rejects invalid credentials', async () => {
    const response = await client.post('/api/auth/login', {
      email: 'user@example.com',
      password: 'wrong',
    })

    expect(response.status).toBe(401)
  })
})
```

### Component Test Example

```typescript
// tests/unit/components/Button.test.ts
import { describe, expect, it } from 'bun:test'
import { mount } from '@vue/test-utils'
import Button from '@/components/Button.vue'

describe('Button Component', () => {
  it('renders correctly', () => {
    const wrapper = mount(Button, {
      props: { label: 'Click me' },
    })

    expect(wrapper.text()).toContain('Click me')
  })

  it('emits click event', async () => {
    const wrapper = mount(Button)
    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toBeTruthy()
  })
})
```

## Test Configuration

Configure tests in `config/testing.ts`:

```typescript
export default {
  // Test directories
  unit: 'tests/unit',
  feature: 'tests/feature',

  // Setup file
  setupFiles: ['tests/setup.ts'],

  // Coverage settings
  coverage: {
    enabled: true,
    exclude: ['node_modules', 'dist'],
  },

  // Timeout
  timeout: 10000,
}
```

## Test Setup

Create a setup file for global test configuration:

```typescript
// tests/setup.ts
import { beforeAll, afterAll, afterEach } from 'bun:test'
import { setupTestDatabase, teardownTestDatabase } from '@stacksjs/testing'

beforeAll(async () => {
  await setupTestDatabase()
})

afterEach(async () => {
  // Clean up after each test
})

afterAll(async () => {
  await teardownTestDatabase()
})
```

## Coverage Reports

Generate test coverage:

```bash
buddy test --coverage
# or
buddy test:coverage
```

Coverage output:
```
Coverage:
  Statements: 85.5%
  Branches: 78.2%
  Functions: 90.1%
  Lines: 85.5%

Detailed report: coverage/index.html
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run tests
        run: buddy test

      - name: Type check
        run: buddy test:types
```

## Troubleshooting

### Tests Not Found

```
Error: No tests found
```

**Solutions**:
1. Ensure test files match pattern: `*.test.ts` or `*.spec.ts`
2. Check test directory structure
3. Verify file paths in configuration

### Test Timeout

```
Error: Test timed out
```

**Solutions**:
1. Increase timeout in test or configuration
2. Check for hanging promises
3. Ensure async operations complete

```typescript
it('long running test', async () => {
  // Set timeout for this test
}, 30000)
```

### Type Errors

```
Error: TypeScript errors found
```

**Solution**: Fix type errors or update types:
```bash
# See detailed errors
buddy test:types --verbose

# Generate missing types
buddy generate:types
```

### Database Issues

```
Error: Database connection failed
```

**Solutions**:
1. Ensure test database is configured
2. Run migrations: `APP_ENV=testing buddy migrate`
3. Check database credentials

## Best Practices

### Test Naming

Use descriptive test names:

```typescript
// Good
it('returns error when email is invalid', () => {})

// Bad
it('test email', () => {})
```

### Test Isolation

Each test should be independent:

```typescript
beforeEach(() => {
  // Reset state before each test
})
```

### Mock External Services

```typescript
import { mock } from 'bun:test'

const mockFetch = mock(async () => ({
  ok: true,
  json: async () => ({ data: 'mocked' }),
}))

global.fetch = mockFetch
```

### Test Organization

Group related tests:

```typescript
describe('User Service', () => {
  describe('create', () => {
    it('creates user with valid data', () => {})
    it('validates required fields', () => {})
  })

  describe('update', () => {
    it('updates user data', () => {})
    it('rejects unauthorized updates', () => {})
  })
})
```

## Related Commands

- [buddy lint](/guide/buddy/lint) - Lint code
- [buddy build](/guide/buddy/build) - Build project
- [buddy dev](/guide/buddy/dev) - Development server
