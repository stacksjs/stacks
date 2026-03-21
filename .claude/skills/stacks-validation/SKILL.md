---
name: stacks-validation
description: Use when implementing input validation in a Stacks application — request validation, form validation, custom validation rules, or data sanitization. Covers @stacksjs/validation.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Validation

The `@stacksjs/validation` package provides a validation framework for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/validation/src/`
- Package: `@stacksjs/validation`

## Features
- Request/input validation
- Custom validation rules
- Form validation support
- Data sanitization
- Type-safe validation schemas

## Usage
```typescript
import { validate, rules } from '@stacksjs/validation'
```

## Integration
- Used by `@stacksjs/router` for route request validation
- Works with forms and API endpoints
- Model attribute validation

## Gotchas
- Validation is applied at the router/request level
- Custom rules can be defined and reused
- Validation errors are structured for API responses
- Always validate user input at system boundaries
