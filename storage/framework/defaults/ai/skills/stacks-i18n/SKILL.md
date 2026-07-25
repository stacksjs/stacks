---
name: stacks-i18n
description: Use when working with internationalization in a Stacks application — translations, locale management, pluralization, date/number/currency formatting, or loading translation files. Covers @stacksjs/i18n with translator, formatter, loader, and pluralization modules.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks i18n

## Key Paths
- Core package: `storage/framework/core/i18n/src/`
- Locale files: `locales/` (en.yml, de.yml)
- Package: `@stacksjs/i18n`

## Source Files
```
i18n/src/
├── index.ts              # Main entry point and exports
├── types.ts              # All type definitions
├── translator.ts         # I18n class, global API (t, tc, te, tm)
├── formatter.ts          # Locale-aware formatting (dates, numbers, currency, lists)
├── loader.ts             # File-based translation loader (JSON, YAML, JS/TS)
└── pluralization.ts      # CLDR plural rules for 25+ languages
```

## Core Types

```typescript
type TranslationMessages = { [key: string]: string | TranslationMessages }
type Translations = { [locale: string]: TranslationMessages }
type InterpolationValues = Record<string, string | number | boolean | null | undefined>

interface I18nConfig {
  locale: string                    // default: 'en'
  fallbackLocale: string            // default: 'en'
  availableLocales?: string[]
  messages?: Translations
  missingHandler?: (locale: string, key: string) => string | undefined
  warnMissing?: boolean             // default: true
  escapeValues?: boolean            // default: false
  keySeparator?: string             // default: '.'
  pluralSeparator?: string          // default: '|'
  dateTimeFormats?: DateTimeFormats
  numberFormats?: NumberFormats
}
```

## Translation API

### Instance-Based
```typescript
import { createI18n, useI18n } from '@stacksjs/i18n'

const i18n = createI18n({
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: { greeting: 'Hello, {name}!' },
    de: { greeting: 'Hallo, {name}!' },
  },
})

i18n.t('greeting', { name: 'World' })  // 'Hello, World!'
i18n.setLocale('de')
i18n.t('greeting', { name: 'Welt' })   // 'Hallo, Welt!'
```

### Global API
```typescript
import { t, tc, te, tm, trans, setLocale, getLocale, addTranslations, configure } from '@stacksjs/i18n'

t('greeting', { name: 'World' })         // Translate with interpolation
tc('items', 5, { count: 5 })             // Plural translation
te('greeting')                            // Key exists? → boolean
tm('section')                             // Raw message object
trans('greeting')                         // Alias for t()

setLocale('fr')
getLocale()                               // 'fr'
addTranslations('fr', { greeting: 'Bonjour, {name}!' })
```

### Lookup Flow
```
1. Look up key in target locale
2. If not found → try fallback locale
3. If still not found → call missingHandler → warn → return key string
```

## Pluralization

CLDR plural rules, pipe-separated forms:

```typescript
addTranslations('en', { items: 'no items | one item | {count} items' })
tc('items', 0)    // 'no items'
tc('items', 1)    // 'one item'
tc('items', 5)    // '5 items'
```

### Supported Languages

| Rule | Languages |
|------|-----------|
| One/Other | en, de, nl, es, it, pt, sv, da, no, fi, el, he, hu, tr |
| French (0-1=one) | fr |
| No plural | zh, ja, ko, vi, th, id, ms |
| One/Few/Many/Other | ru, uk, pl |
| One/Few/Other | cs, sk |
| Full (zero/one/two/few/many/other) | ar, cy |

```typescript
import { getPluralCategory, addPluralRule, hasPluralRule } from '@stacksjs/i18n'
getPluralCategory(1, 'en')     // 'one'
getPluralCategory(5, 'en')     // 'other'
```

## Formatting

### Date/Time
```typescript
import { formatDate, formatTime, formatDateTime, formatRelativeTime } from '@stacksjs/i18n'

formatDate(new Date(), 'long')                    // 'March 23, 2026'
formatDate(new Date(), 'short')                   // '3/23/26'
formatTime(new Date(), 'short')                   // '2:30 PM'
formatDateTime(new Date(), 'medium', 'short')     // 'Mar 23, 2026, 2:30 PM'
formatRelativeTime(pastDate)                      // '3 hours ago'
```

### Numbers & Currency
```typescript
import { formatNumber, formatCurrency, formatPercent, formatUnit, formatBytes } from '@stacksjs/i18n'

formatNumber(1234567)                              // '1,234,567'
formatNumber(1234567, { compact: true })           // '1.2M'
formatCurrency(29.99)                              // '$29.99'
formatCurrency(29.99, 'EUR', {}, 'de')             // '29,99 €'
formatPercent(0.85)                                // '85%'
formatUnit(60, 'kilometer-per-hour', 'short')      // '60 km/h'
formatBytes(1536)                                  // '1.50 KB'
```

### Lists & Display Names
```typescript
import { formatList, getLanguageName, getRegionName, isRTL } from '@stacksjs/i18n'

formatList(['Alice', 'Bob', 'Charlie'])            // 'Alice, Bob, and Charlie'
formatList(['A', 'B'], 'disjunction')              // 'A or B'
getLanguageName('de')                               // 'German'
getRegionName('JP')                                 // 'Japan'
isRTL('ar')                                         // true
```

### String Collation
```typescript
import { sortStrings, compareStrings } from '@stacksjs/i18n'
sortStrings(['ö', 'a', 'ü'], {}, 'de')            // Locale-aware sort
```

## Translation File Loader

```typescript
import { loadFromDirectory, loadFile, createLoader } from '@stacksjs/i18n'

const translations = await loadFromDirectory({
  directory: './locales',
  extensions: ['.json', '.yaml', '.yml', '.ts', '.js'],
  recursive: false,
})

const loader = createLoader('./locales')
const all = await loader.load()
const fr = await loader.loadLocale('fr', 'messages.yml')
```

## Locale Files

```yaml
# locales/en.yml
default:
  button:
    about: About
    back: Back
  intro:
    desc: Rapid Application Development
    hi: 'Hi, {name}!'
```

## Gotchas
- **Dual API** — instance-based (`createI18n()`) and global (`t()`) both exist. Global uses a singleton
- **YAML parsed with Bun.YAML** — not a third-party parser
- **Missing keys return the key itself** — not an error, not empty string
- **Pluralization uses `|` separator** — not ICU MessageFormat
- **CLDR rules are built-in** — no external data needed, 25+ languages hardcoded
- **HTML escaping is opt-in** — `escapeValues: true` in config
- **Formatting uses Intl APIs** — delegates to `Intl.DateTimeFormat`, `Intl.NumberFormat`, etc.
