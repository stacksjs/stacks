---
name: stacks-error-handling
description: Use when implementing error handling in a Stacks application — custom error types, error boundaries, error reporting, or the error handling configuration. Covers @stacksjs/error-handling and config/errors.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Error Handling

The `@stacksjs/error-handling` package provides type-safe error handling for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/error-handling/src/`
- Configuration: `config/errors.ts`
- Error model: `storage/framework/models/Error.ts`
- Package: `@stacksjs/error-handling`

## Features
- Type-safe error classes
- Error boundary patterns
- Structured error reporting
- Error logging integration

## Usage
```typescript
import { StacksError, handleError } from '@stacksjs/error-handling'
```

## Error Model
The `Error` model at `storage/framework/models/Error.ts` persists errors to the database for tracking and analysis.

## Integration
- Works with `@stacksjs/logging` for error logging
- Errors are tracked in the database via the Error model
- Error configuration in `config/errors.ts`

## Gotchas
- Use structured error types, not raw `throw new Error()`
- Error handling is a dependency of many other packages
- The error configuration controls error display and reporting behavior
- Prefer `@stacksjs/error-handling` over manual try/catch for consistency
