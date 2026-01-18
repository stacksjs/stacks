# Console Tests

Console tests verify that your CLI commands work correctly. Stacks provides utilities for testing Artisan-style commands, including argument parsing, output verification, and interactive prompts.

## Overview

Console tests help you:

- **Test commands** - Verify CLI commands execute correctly
- **Check output** - Assert on command output and formatting
- **Test arguments** - Verify argument and option handling
- **Test prompts** - Mock interactive user input

## Writing Console Tests

### Basic Command Test

```typescript
// tests/Console/GreetCommandTest.ts
import { describe, expect, it } from 'bun:test'
import { command } from '@stacksjs/testing'

describe('Greet Command', () => {
  it('greets the user', async () => {
    const result = await command('greet John')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Hello, John!')
  })

  it('uses default name when none provided', async () => {
    const result = await command('greet')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Hello, World!')
  })

  it('supports --loud option', async () => {
    const result = await command('greet John --loud')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('HELLO, JOHN!')
  })
})
```

### Testing Command Arguments

```typescript
// tests/Console/MakeModelCommandTest.ts
import { describe, expect, it } from 'bun:test'
import { command } from '@stacksjs/testing'
import { existsSync, unlinkSync } from 'node:fs'

describe('Make Model Command', () => {
  const testModelPath = 'app/Models/TestModel.ts'

  afterEach(() => {
    // Cleanup generated files
    if (existsSync(testModelPath)) {
      unlinkSync(testModelPath)
    }
  })

  it('creates a model file', async () => {
    const result = await command('make:model TestModel')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Model created successfully')
    expect(existsSync(testModelPath)).toBe(true)
  })

  it('creates model with migration', async () => {
    const result = await command('make:model TestModel --migration')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Model created successfully')
    expect(result.output).toContain('Migration created successfully')
  })

  it('fails when model already exists', async () => {
    await command('make:model TestModel')
    const result = await command('make:model TestModel')

    expect(result.exitCode).toBe(1)
    expect(result.output).toContain('already exists')
  })

  it('creates model with --force when exists', async () => {
    await command('make:model TestModel')
    const result = await command('make:model TestModel --force')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Model created successfully')
  })
})
```

## Testing Output

### Output Assertions

```typescript
import { describe, expect, it } from 'bun:test'
import { command } from '@stacksjs/testing'

describe('List Command', () => {
  it('displays items in table format', async () => {
    const result = await command('list:users')

    // Check table headers
    expect(result.output).toContain('ID')
    expect(result.output).toContain('Name')
    expect(result.output).toContain('Email')

    // Check content
    expect(result.output).toContain('john@example.com')
  })

  it('shows info messages', async () => {
    const result = await command('db:seed')

    expect(result.output).toContain('INFO')
    expect(result.output).toContain('Database seeded')
  })

  it('shows warning messages', async () => {
    const result = await command('cache:clear --all')

    expect(result.output).toContain('WARNING')
    expect(result.output).toContain('clearing all caches')
  })

  it('shows error messages on failure', async () => {
    const result = await command('db:migrate --invalid-option')

    expect(result.exitCode).toBe(1)
    expect(result.output).toContain('ERROR')
  })
})
```

### JSON Output

```typescript
describe('Export Command', () => {
  it('outputs valid JSON', async () => {
    const result = await command('export:users --format=json')

    expect(result.exitCode).toBe(0)

    const data = JSON.parse(result.output)
    expect(Array.isArray(data)).toBe(true)
    expect(data[0]).toHaveProperty('id')
    expect(data[0]).toHaveProperty('email')
  })

  it('supports pretty JSON output', async () => {
    const result = await command('export:users --format=json --pretty')

    expect(result.output).toContain('\n')  // Has newlines
    expect(result.output).toContain('  ')  // Has indentation
  })
})
```

## Testing Interactive Commands

### Mocking User Input

```typescript
import { describe, expect, it } from 'bun:test'
import { command, withInput } from '@stacksjs/testing'

describe('Interactive Command', () => {
  it('handles confirmation prompt', async () => {
    const result = await command('db:drop')
      .withInput(['yes'])  // Respond to confirmation

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Database dropped')
  })

  it('aborts on negative confirmation', async () => {
    const result = await command('db:drop')
      .withInput(['no'])

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Operation cancelled')
  })

  it('handles multiple prompts', async () => {
    const result = await command('make:crud')
      .withInput([
        'Post',           // Model name
        'yes',            // Create migration?
        'yes',            // Create controller?
        'posts',          // Table name
      ])

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('CRUD scaffolding created')
  })

  it('handles select prompts', async () => {
    const result = await command('new:project')
      .withInput([
        'my-project',     // Project name
        'web',            // Select project type (web/api/fullstack)
        ['auth', 'api'],  // Multi-select features
      ])

    expect(result.exitCode).toBe(0)
  })
})
```

### Testing Password Input

```typescript
describe('Auth Commands', () => {
  it('creates user with password', async () => {
    const result = await command('make:user')
      .withInput([
        'admin@example.com',  // Email
        'Admin User',          // Name
        'secretpassword',      // Password (hidden input)
        'secretpassword',      // Confirm password
      ])

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('User created')
    // Password should not be echoed
    expect(result.output).not.toContain('secretpassword')
  })
})
```

## Testing with Database

### Database Commands

```typescript
import { describe, expect, it } from 'bun:test'
import { command, useTransaction } from '@stacksjs/testing'
import { db } from '@stacksjs/database'

describe('Database Commands', () => {
  useTransaction()

  it('seeds the database', async () => {
    const result = await command('db:seed')

    expect(result.exitCode).toBe(0)

    const users = await db.selectFrom('users').selectAll().execute()
    expect(users.length).toBeGreaterThan(0)
  })

  it('runs specific seeder', async () => {
    const result = await command('db:seed --class=UserSeeder')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('UserSeeder')
  })

  it('runs migrations', async () => {
    const result = await command('migrate')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Migrated')
  })

  it('shows migration status', async () => {
    await command('migrate')
    const result = await command('migrate:status')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Ran')
  })

  it('rolls back migrations', async () => {
    await command('migrate')
    const result = await command('migrate:rollback')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Rolled back')
  })
})
```

## Testing Scheduled Commands

```typescript
import { describe, expect, it, setSystemTime } from 'bun:test'
import { command } from '@stacksjs/testing'

describe('Scheduled Commands', () => {
  it('runs due scheduled tasks', async () => {
    // Set time to when task should run
    setSystemTime(new Date('2024-01-15T00:00:00Z'))

    const result = await command('schedule:run')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Running scheduled tasks')
  })

  it('lists scheduled tasks', async () => {
    const result = await command('schedule:list')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('cleanup:logs')
    expect(result.output).toContain('0 0 * * *')  // Cron expression
  })
})
```

## Testing Queue Commands

```typescript
import { describe, expect, it } from 'bun:test'
import { command } from '@stacksjs/testing'

describe('Queue Commands', () => {
  it('lists queued jobs', async () => {
    const result = await command('queue:list')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Pending Jobs')
  })

  it('processes jobs', async () => {
    const result = await command('queue:work --once')

    expect(result.exitCode).toBe(0)
  })

  it('clears failed jobs', async () => {
    const result = await command('queue:flush')
      .withInput(['yes'])

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Flushed')
  })

  it('retries failed jobs', async () => {
    const result = await command('queue:retry --all')

    expect(result.exitCode).toBe(0)
  })
})
```

## Testing Exit Codes

```typescript
import { describe, expect, it } from 'bun:test'
import { command } from '@stacksjs/testing'

describe('Exit Codes', () => {
  it('returns 0 on success', async () => {
    const result = await command('list')

    expect(result.exitCode).toBe(0)
  })

  it('returns 1 on error', async () => {
    const result = await command('nonexistent:command')

    expect(result.exitCode).toBe(1)
  })

  it('returns custom exit codes', async () => {
    const result = await command('validate:config')

    // 0 = valid, 2 = warnings, 1 = errors
    expect([0, 1, 2]).toContain(result.exitCode)
  })
})
```

## Testing Environment-Specific Commands

```typescript
import { describe, expect, it } from 'bun:test'
import { command, withEnv } from '@stacksjs/testing'

describe('Environment Commands', () => {
  it('runs only in production', async () => {
    const result = await command('deploy:assets')
      .withEnv({ NODE_ENV: 'development' })

    expect(result.exitCode).toBe(1)
    expect(result.output).toContain('only in production')
  })

  it('runs with custom env vars', async () => {
    const result = await command('config:show')
      .withEnv({
        APP_DEBUG: 'true',
        DB_CONNECTION: 'sqlite',
      })

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('sqlite')
  })
})
```

## Running Console Tests

```bash
# Run all console tests
buddy test tests/Console

# Run specific test file
bun test tests/Console/MakeModelCommandTest.ts

# Run with verbose output
buddy test tests/Console --verbose

# Watch mode
buddy test tests/Console --watch
```

## Best Practices

### DO

- **Test exit codes** - Verify success (0) and failure (non-zero)
- **Test output messages** - Users rely on command feedback
- **Test error cases** - Invalid arguments, missing files, etc.
- **Clean up generated files** - Don't leave test artifacts
- **Mock external services** - Don't make real API calls

### DON'T

- **Don't test framework code** - Focus on your commands
- **Don't skip interactive tests** - Mock user input instead
- **Don't hardcode paths** - Use configuration/helpers
- **Don't ignore stderr** - Error output matters too

## Related Documentation

- **[Testing Overview](/testing/getting-started)** - Getting started with testing
- **[Commands](/basics/commands)** - Creating CLI commands
- **[Feature Tests](/testing/feature-tests)** - Integration testing
- **[Mocking](/testing/mocking)** - Mocking dependencies
