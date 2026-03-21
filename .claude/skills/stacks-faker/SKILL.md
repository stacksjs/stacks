---
name: stacks-faker
description: Use when generating fake/test data in a Stacks application — seeding databases, creating test fixtures, or generating mock data. Covers the @stacksjs/faker package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Faker

The `@stacksjs/faker` package provides fake data generation for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/faker/src/`
- Database seeds: `database/`
- Package: `@stacksjs/faker`

## Features
- Generate realistic fake data for testing
- Database seeding support
- Custom faker providers
- Locale-aware data generation

## Usage
```typescript
import { faker } from '@stacksjs/faker'

faker.name()
faker.email()
faker.address()
```

## CLI Commands
- `buddy seed` - Seed the database with fake data

## Integration
- Used with `buddy seed` for database seeding
- Factories use faker for model data generation
- `buddy make:factory` creates factory files that use faker

## Gotchas
- Faker is for development/testing only, not production
- Custom factories go alongside model definitions
- Use `buddy make:factory` to scaffold new factories
- Seeds are in the `database/` directory
