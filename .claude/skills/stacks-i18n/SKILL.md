---
name: stacks-i18n
description: Use when implementing internationalization in a Stacks application — translations, locale management, language files, or multi-language support. Covers @stacksjs/i18n and the locales/ directory.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Internationalization

The `@stacksjs/i18n` package provides internationalization support for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/i18n/src/`
- Locale files: `locales/`
- Default language files: `storage/framework/defaults/lang/`
- Package: `@stacksjs/i18n`

## Features
- Translation management
- Locale detection and switching
- Language file organization
- Pluralization support
- Date/number formatting per locale

## CLI Commands
- `buddy make:lang` - Create a new language file

## Architecture
- Translation files are stored in `locales/` at the project root
- Default language templates in `storage/framework/defaults/lang/`
- Application locale is configured in `config/app.ts`

## Usage
```typescript
import { t, setLocale } from '@stacksjs/i18n'

t('messages.welcome')
```

## Gotchas
- Default locale is set in `config/app.ts`
- Language files go in `locales/`
- Use `buddy make:lang` to scaffold new language files
- Translations support interpolation and pluralization
