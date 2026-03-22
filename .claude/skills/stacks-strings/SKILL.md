---
name: stacks-strings
description: Use when working with string utilities in Stacks — case conversion (camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, Train-Case, etc.), pluralization, string validation (email, URL, UUID, credit card, etc.), slug generation, random strings, template interpolation, or the Str facade. Covers @stacksjs/strings.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Strings

## Key Paths
- Core package: `storage/framework/core/strings/src/`
- Package: `@stacksjs/strings`
- Entry: `storage/framework/core/strings/src/string.ts` (re-exports all submodules)

## Architecture

The package re-exports from these submodules:
- `case.ts` — case conversion functions (camelCase, pascalCase, snakeCase, etc.)
- `pluralize.ts` — English pluralization/singularization with rule engine
- `slug.ts` — URL slug generation with extensive character map
- `utils.ts` — random strings, template interpolation, slash, prefix/suffix, truncate, detect-indent, detect-newline
- `macro.ts` — `Str` and `str` facade objects
- `validators.ts` — re-exports from `is.ts` (native string validators)
- `sponge-case.ts` — random upper/lower case
- `swap-case.ts` — swap upper/lower case
- `title-case.ts` — intelligent title case with small word handling

The top-level `index.ts` does:
```typescript
export * from './string'
export * as string from './string'
```

And `string.ts` does:
```typescript
export * from './case'
export * from './helpers'
export * from './macro'
export * from './pluralize'
export * from './slug'
export * from './utils'
export * from './validators'
```

## Case Conversion Functions

All accept `(input: string, options?: CaseOptions)` and use Unicode-aware word boundary detection via regex patterns (`\p{Ll}`, `\p{Lu}`).

```typescript
interface CaseOptions {
  locale?: string[] | string | false | undefined
  split?: (value: string) => string[]
  delimiter?: string
  prefixCharacters?: string   // characters to preserve as prefix
  suffixCharacters?: string   // characters to preserve as suffix
}

interface PascalCaseOptions extends CaseOptions {
  mergeAmbiguousCharacters?: boolean
}
```

### Functions

```typescript
camelCase('hello world')        // 'helloWorld'  — first word lowercase, rest capitalized
pascalCase('hello world')       // 'HelloWorld'  — all words capitalized
snakeCase('hello world')        // 'hello_world' — alias for noCase with '_' delimiter
kebabCase('hello world')        // 'hello-world' — alias for noCase with '-' delimiter
constantCase('hello world')     // 'HELLO_WORLD' — all uppercase with '_' delimiter
trainCase('hello world')        // 'Hello-World' — capitalCase with '-' delimiter
dotCase('hello world')          // 'hello.world' — noCase with '.' delimiter
pathCase('hello world')         // 'hello/world' — noCase with '/' delimiter
sentenceCase('hello world')     // 'Hello world' — first word capitalized, rest lowercase
capitalCase('hello world')      // 'Hello World' — all words capitalized, space delimiter
noCase('helloWorld')            // 'hello world' — lowercase with space delimiter
pascalSnakeCase('hello world')  // 'Hello_World' — capitalCase with '_' delimiter
paramCase('hello world')        // 'hello-world' — alias for kebabCase
```

### Special Case Functions

```typescript
spongeCase('hello world')       // 'hElLo wOrLd' — random upper/lower per character
spongeCase('hello', 'en')       // accepts optional locale

swapCase('Hello')               // 'hELLO' — swaps each character's case
swapCase('Hello', 'en')         // accepts optional locale
```

### Title Case

```typescript
titleCase('hello world')                          // 'Hello World'
titleCase('the quick brown fox')                  // 'The Quick Brown Fox'
titleCase('the quick brown fox', { sentenceCase: true })  // 'The quick brown fox'

interface TitleCaseOptions {
  locale?: string | string[]
  sentenceCase?: boolean                 // only capitalize first word + after terminators
  sentenceTerminators?: Set<string>      // default: '.', '!', '?'
  titleTerminators?: Set<string>         // default: '.', '!', '?', ':', '"', "'", '"'
  smallWords?: Set<string>               // words not capitalized (see SMALL_WORDS)
  wordSeparators?: Set<string>           // default: '---', '--', '-', '---', '/'
}
```

Handles special cases: URLs, email addresses, acronyms (e.g., "U.S.A."), camelCase words (e.g., "iPhone"), and hyphenated compound words.

### Word Splitting

```typescript
split('camelCase')              // ['camel', 'Case']
split('hello_world')            // ['hello', 'world']
split('HTTPSRequest')           // ['HTTPS', 'Request']
splitSeparateNumbers('test123') // ['test', '123']
```

Uses Unicode-aware regex for word boundary detection. Handles camelCase, PascalCase, snake_case, UPPER_CASE, and mixed formats.

## Pluralization

Full English pluralization engine with irregular words, custom rules, and uncountable nouns.

```typescript
import { plural, singular, pluralize } from '@stacksjs/strings'

// Basic usage
plural('person')                        // 'people'
plural('person', 1)                     // 'person'  (count-aware)
singular('people')                      // 'person'

// Pluralize function with options
pluralize('mouse')                      // 'mice'
pluralize('mouse', { count: 1 })        // 'mouse'
pluralize('mouse', { count: 2 })        // 'mice'
pluralize('mouse', { count: 5, inclusive: true })  // '5 mice'

// Boolean checks
pluralize.isPlural('dogs')              // true
pluralize.isSingular('dog')             // true

// Custom rules
pluralize.addPluralRule(/gex$/i, 'gices')
pluralize.addSingularRule(/gices$/i, 'gex')
pluralize.addIrregularRule('person', 'people')
pluralize.addUncountableRule('sheep')
```

### Built-in Irregular Words
The engine includes 48 irregular word pairs (e.g., ox/oxen, foot/feet, goose/geese, child/children, person/people, die/dice, tooth/teeth, quiz/quizzes, etc.).

### Built-in Uncountable Words
Includes 74 uncountable words (e.g., sheep, fish, moose, aircraft, software, equipment, information, etc.) plus regex patterns for Pokemon, words ending in non-ASCII `ese`, deer, fish, measles, pox, sheep.

### Case Preservation
The pluralization engine preserves the case pattern of the input word:
- `'PERSON'` -> `'PEOPLE'`
- `'Person'` -> `'People'`
- `'person'` -> `'people'`

## Slug Generation

Two slug functions with different defaults:

### `slug(str, options?)` — Simple slug (strict + lowercase by default)
```typescript
slug('Hello World')              // 'hello-world'
slug('Hello World', { lower: false })  // 'Hello-World'
```

### `slugify(str, options?)` — Full-featured slug
```typescript
slugify('Hello World!')          // 'Hello-World!'  (not strict/lowercase by default)
slugify('Hello World!', { lower: true, strict: true })  // 'hello-world'

interface SlugifyOptions {
  replacement?: string    // default: '-'
  remove?: RegExp         // chars to remove (default: /[^\w\s$*+~.()'"!\-:@]+/g)
  lower?: boolean         // default: false
  strict?: boolean        // strip non-alphanumeric (default: false)
  locale?: string         // locale-specific char mapping
  trim?: boolean          // trim result (default: true)
}
```

### Character Map
Extensive built-in character map covering:
- Latin extended (accented chars): A-Z with diacritics
- Greek alphabet
- Cyrillic alphabet
- Armenian alphabet
- Arabic alphabet and numerals
- Georgian alphabet
- Vietnamese diacritics
- Currency symbols ($, EUR, GBP, YEN, etc.)
- Special characters (trademark, copyright, etc.)

### Locale Support
Locale-specific character mappings for: `bg`, `de`, `es`, `fr`, `pt`, `uk`, `vi`, `da`, `nb`, `it`, `nl`, `sv`.

```typescript
slugify('AE', { locale: 'de' })  // 'AE' (German)
slugify('AE')                     // 'A'  (default)
```

### Extending the Character Map
```typescript
extendCharMap({ 'EUR': 'EUR', 'GBP': 'GBP' })
```

## String Utilities

```typescript
capitalize('hello world')                  // 'Hello world' — first char upper, rest lower
lowercase('HELLO')                         // 'hello'
slash('path\\to\\file')                    // 'path/to/file'
ensurePrefix('https://', 'google.com')     // 'https://google.com'
ensurePrefix('https://', 'https://x.com') // 'https://x.com' (already has prefix)
ensureSuffix('.ts', 'file')                // 'file.ts'
ensureSuffix('.ts', 'file.ts')             // 'file.ts' (already has suffix)
template('Hello {0}! My name is {1}.', 'Buddy', 'Chris')  // 'Hello Buddy! My name is Chris.'
truncate('long text here', 10, '...')      // 'long te...'
truncate('short', 10)                      // 'short' (no truncation needed)
random()                                    // 16-char random string (nanoid-style)
random(21)                                  // 21-char random string
random(10, 'abc')                           // 10-char string from custom alphabet
```

### `urlAlphabet` Constant
```typescript
// 64 URL-safe characters used by random() by default
const urlAlphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'
```

## String Validators

Native TypeScript implementations (no external validator dependency). All accept a string and return boolean.

### Core Validators
```typescript
isEmail('user@example.com')               // true -- regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
isStrongPassword('Abc123!@#')             // true -- min 8 chars, upper, lower, digit, symbol
isAlphanumeric('abc123')                  // true -- /^[a-zA-Z0-9]+$/
isAlpha('abcdef')                         // true -- /^[a-zA-Z]+$/
isNumeric('123')                          // true -- /^[0-9]+$/ (whole numbers only)
isURL('https://example.com')              // true -- uses URL constructor, requires http(s) protocol
```

### Format Validators
```typescript
isHexColor('#ff0000')                     // true -- 3 or 6 hex digits with #
isHexadecimal('deadbeef')                 // true -- hex chars only
isBase64('SGVsbG8=')                      // true -- btoa(atob(x)) === x
isBase32('MFZWI===')                      // true -- /^[A-Z2-7]+=*$/
isAscii('hello')                          // true -- /^[\x00-\x7F]*$/
isJSON('{"key":"value"}')                 // true -- JSON.parse succeeds
isHSL('hsl(0, 100%, 50%)')               // true
isMimeType('text/html')                   // true -- /^[a-z]+\/[a-z0-9\-+.]+$/i
isDataURI('data:text/plain;base64,...')   // true
isJWT('eyJhbGciOi...')                    // true -- 3 dot-separated base64url segments
```

### Network Validators
```typescript
isIP('192.168.1.1')                       // true -- IPv4 and IPv6
isIPRange('192.168.1.0/24')               // true -- CIDR notation (IPv4: 0-32, IPv6: 0-128)
isMACAddress('00:11:22:33:44:55')         // true -- colon or hyphen separated
isFQDN('example.com')                     // true -- fully qualified domain name
```

### Financial Validators
```typescript
isCreditCard('4111111111111111')           // true -- Luhn algorithm, 13-19 digits
isISBN('978-3-16-148410-0')               // true -- ISBN-10 and ISBN-13 with checksum
isCurrency('$1,234.56')                   // true -- supports $, GBP, EUR, YEN
isIBAN('DE89370400440532013000')           // true -- mod 97 check
isISIN('US0378331005')                     // true -- Luhn algorithm
isISSN('0378-5955')                        // true -- mod 11 check
```

### Geographic Validators
```typescript
isLatLong('40.7128,-74.0060')             // true -- lat: -90..90, long: -180..180
isLatitude('40.7128')                     // true
isLongitude('-74.0060')                   // true
isPostalCode('12345')                     // true -- US, UK, Canada, generic formats
```

### Phone, Identity, Date Validators
```typescript
isMobilePhone('+1234567890')              // true -- international format, min 7 digits
isUUID('550e8400-e29b-41d4-a716...')      // true -- v1-v5
isISO8601('2024-01-01T00:00:00Z')         // true -- with Date validity check
isIdentityCard('AB123456')                // true -- generic 5-20 alphanumeric
isISRC('USRC17607839')                    // true
isISO31661Alpha2('US')                    // true
isISO31661Alpha3('USA')                   // true
validateUsername('user123')               // true -- alias for isAlphanumeric
isHash('abc123...', 'md5')               // true -- supports md5(32), sha1(40), sha256(64), sha384(96), sha512(128)
isByteLength('hello', { min: 1, max: 10 }) // true
isFullWidth('\uFF21')                     // true
isHalfWidth('a')                          // true
```

## Newline & Indentation Detection

### Newline Detection (from `detect-newline.ts`)
```typescript
detectNewline('line1\r\nline2')          // '\r\n'
detectNewline('line1\nline2')            // '\n'
detectNewline('no newline')              // undefined
detectNewlineGraceful(text)              // '\n' (fallback when no newline found)
```

The detection counts CRLF vs LF occurrences and returns the dominant type.

### Indentation Detection (from `detect-indent.ts`)
```typescript
detectIndent('  hello\n    world')
// { amount: 2, type: 'space', indent: '  ' }

detectIndent('\thello\n\t\tworld')
// { amount: 1, type: 'tab', indent: '\t' }

detectIndent('no indent')
// { amount: 0, type: undefined, indent: '' }
```

Algorithm: builds a frequency map of indent changes (type + size), handles edge cases like single-space indentation (skipped by default to avoid false positives from code comments), then selects the most common indent pattern.

## Str Facade Object

Both `Str` and `str` are exported as equivalent facade objects providing all functions as methods.

```typescript
import { Str, str } from '@stacksjs/strings'

// Case conversion
Str.camelCase('hello world')      // 'helloWorld'
Str.pascalCase('hello world')     // 'HelloWorld'
Str.snakeCase('hello world')      // 'hello_world'
Str.kebabCase('hello world')      // 'hello-world'
Str.constantCase('hello world')   // 'HELLO_WORLD'
Str.dotCase('hello world')        // 'hello.world'
Str.noCase('helloWorld')          // 'hello world'
Str.paramCase('hello world')      // 'hello-world'
Str.pathCase('hello world')       // 'hello/world'
Str.sentenceCase('hello world')   // 'Hello world'
Str.capitalCase('hello world')    // 'Hello World'
Str.titleCase('hello world')      // 'Hello World'

// Utilities
Str.capitalize('hello')           // 'Hello'
Str.slug('Hello World')           // 'hello-world'
Str.random(16)                    // random string
Str.random(10, 'abc')             // random from custom dict
Str.template('{0} {1}', 'a', 'b')  // 'a b'
Str.truncate('long text', 5)      // 'lo...'
Str.slash('path\\to')             // 'path/to'
Str.ensurePrefix('/', 'path')     // '/path'
Str.ensureSuffix('.ts', 'file')   // 'file.ts'
Str.detectIndent(text)            // { amount, type, indent }
Str.detectNewline(text)           // '\n' | '\r\n' | undefined

// Pluralization
Str.plural('person')              // 'people'
Str.singular('people')            // 'person'
Str.isPlural('dogs')              // true
Str.isSingular('dog')             // true
Str.addPluralRule(/ox$/i, 'oxen')
Str.addSingularRule(/oxen$/i, 'ox')
Str.addIrregularRule('goose', 'geese')
Str.addUncountableRule('sheep')
```

## Exported Constants

```typescript
// From title-case.ts
WORD_SEPARATORS: Set<string>      // '---', '--', '-', '---', '/'
SENTENCE_TERMINATORS: Set<string> // '.', '!', '?'
TITLE_TERMINATORS: Set<string>    // '.', '!', '?', ':', '"', "'", '"'
SMALL_WORDS: Set<string>          // 'a', 'an', 'and', 'as', 'at', 'because', 'but', 'by',
                                  // 'en', 'for', 'if', 'in', 'neither', 'nor', 'of', 'on',
                                  // 'only', 'or', 'over', 'per', 'so', 'some', 'than', 'that',
                                  // 'the', 'to', 'up', 'upon', 'v', 'versus', 'via', 'vs',
                                  // 'when', 'with', 'without', 'yet'

// From utils.ts
urlAlphabet: string               // 64 URL-safe chars for random()
```

## Exported Types

```typescript
type Locale = string[] | string | false | undefined
interface CaseOptions { locale?, split?, delimiter?, prefixCharacters?, suffixCharacters? }
interface PascalCaseOptions extends CaseOptions { mergeAmbiguousCharacters? }
interface TitleCaseOptions { locale?, sentenceCase?, sentenceTerminators?, smallWords?, titleTerminators?, wordSeparators? }
interface SlugifyOptions { replacement?, remove?, lower?, strict?, locale?, trim? }
interface PluralizeOptions { count?, inclusive? }
```

## Gotchas
- Case conversion uses Unicode-aware word boundary detection (`\p{Ll}`, `\p{Lu}`) -- handles international characters
- `slug()` calls `slugify()` under the hood but defaults to `{ lower: true, strict: true }`; `slugify()` defaults to `{ lower: false, strict: false }`
- `pascalCase` and `camelCase` accept `PascalCaseOptions` with `mergeAmbiguousCharacters` to control number-prefixed word handling
- All case functions support `prefixCharacters`/`suffixCharacters` to preserve leading/trailing non-word characters
- `pluralize()` is both a function AND an object with methods -- `pluralize.plural()`, `pluralize.singular()`, etc.
- The `random()` function uses `Math.random()`, not crypto -- fine for IDs but not for security tokens
- `isNumeric()` only matches whole numbers (`/^\d+$/`), not floats -- use parseFloat for float checking
- `isURL()` requires `http:` or `https:` protocol -- rejects other protocols and bare domains
- The `Str` facade does NOT include validators -- only case, utility, and pluralization methods
- `helpers.ts` only exports `toString()` which returns `Object.prototype.toString.call(v)`
