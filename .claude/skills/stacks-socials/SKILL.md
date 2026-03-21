---
name: stacks-socials
description: Use when implementing social authentication or social media integration in a Stacks application — OAuth providers, social login, or social sharing. Covers the @stacksjs/socials package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Socials

The `@stacksjs/socials` package provides social authentication and integration for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/socials/src/`
- Package: `@stacksjs/socials`

## Features
- Social OAuth providers (Google, GitHub, Twitter, etc.)
- Social login integration
- Social profile data retrieval
- Social sharing utilities

## Integration
- Works with `@stacksjs/auth` for authentication flow
- OAuth callback handling
- Social profile to user account linking

## Gotchas
- OAuth client IDs and secrets go in `.env`
- Social auth requires proper callback URL configuration
- Integrates with the auth system for user account creation/linking
