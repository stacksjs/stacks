---
name: stacks-ai
description: Use when integrating AI/LLM capabilities into a Stacks application — configuring AI providers, using the AI package, or building AI-powered features. Covers the @stacksjs/ai package and config/ai.ts configuration.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks AI Integration

The `@stacksjs/ai` package provides AI/LLM integration for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/ai/src/`
- Configuration: `config/ai.ts`
- Package: `@stacksjs/ai`

## Configuration
Edit `config/ai.ts` to configure AI providers, models, and defaults.

## Usage
```typescript
import { ai } from '@stacksjs/ai'
```

## Integration Points
- Works with Stacks actions for AI-powered server logic
- Can be used in routes, jobs, and scheduled tasks
- Integrates with the notification system for AI-generated content

## Gotchas
- API keys should be stored in `.env`, never committed
- The AI config supports multiple provider backends
- Always handle AI responses asynchronously
- Rate limiting may apply depending on provider

## Build
```bash
cd storage/framework/core/ai && bun build.ts
```
