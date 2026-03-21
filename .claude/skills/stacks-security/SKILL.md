---
name: stacks-security
description: Use when implementing security features in a Stacks application — CSRF protection, XSS prevention, content security policy, rate limiting, or security headers. Covers @stacksjs/security and config/security.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Security

The `@stacksjs/security` package provides framework security utilities for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/security/src/`
- Configuration: `config/security.ts`
- Hashing config: `config/hashing.ts`
- Package: `@stacksjs/security`

## Features
- CSRF protection
- XSS prevention
- Content Security Policy (CSP)
- Security headers
- Input sanitization
- Encryption utilities

## Configuration
- `config/security.ts` - Security policies and headers
- `config/hashing.ts` - Password hashing algorithms and settings

## Integration
- Works with `@stacksjs/auth` for authentication security
- Applied via middleware for request security
- Security headers are set automatically

## Gotchas
- Security config and hashing config are separate files
- Always use the security middleware for web-facing routes
- Never disable CSRF protection in production
- Password hashing uses the config from `config/hashing.ts`
