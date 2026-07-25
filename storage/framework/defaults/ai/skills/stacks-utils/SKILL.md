---
name: stacks-utils
description: Use when needing general utility functions in Stacks — deep merge, debounce/throttle, color output, byte formatting, markdown tables, YAML parsing, Pipeline class, ResizeObserver, Macroable, project initialization, indentation detection, or the comprehensive utility toolkit. Covers @stacksjs/utils.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Utilities

Umbrella package providing utility functions plus re-exports from specialized packages.

## Key Paths
- Core package: `storage/framework/core/utils/src/`
- Package: `@stacksjs/utils`

## Architecture

The `index.ts` re-exports from these local modules:
- `clean.ts` — project cleanup (`cleanProject()`)
- `config.ts` — config builder re-exports from `@stacksjs/config`
- `equal.ts` — deep equality
- `export-size.ts` — re-exports from `size.ts`
- `find.ts` — find Stacks projects on filesystem
- `git.ts` — git status check
- `hash.ts` — path hashing for cloud deploy
- `helpers.ts` — project helpers (env, YAML, version, npm scripts, etc.)
- `macroable.ts` — dynamic method registration on classes
- `versions.ts` — semver comparison via `Bun.semver`
- `merge.ts` — deep object merge (defu replacement)
- `detect.ts` — indentation and newline detection
- `debounce.ts` — debounce, throttle, delay
- `bytes.ts` — byte formatting and parsing
- `colors.ts` — ANSI terminal color output
- `markdown.ts` — markdown table generation
- `size.ts` — file/export size calculation
- `observer.ts` — ResizeObserver polyfill
- `pipeline.ts` — Pipeline class for data transformation chains

Also re-exports from `@stacksjs/browser`:
```typescript
export * as browserUtils from '@stacksjs/browser'
export { clamp, notNullish, retry, useOnline } from '@stacksjs/browser'
```

## Deep Merge (`merge.ts`)

Replacement for `defu`. Arrays are concatenated, objects are recursively merged, special objects (Date, RegExp, Error, Promise, Map, Set, WeakMap, WeakSet, ArrayBuffer views) are NOT deeply merged.

```typescript
import { merge, mergeDefaults, createMerger, defu } from '@stacksjs/utils'

merge({ a: 1 }, { b: 2 })                    // { a: 1, b: 2 }
merge({ a: [1] }, { a: [2] })                 // { a: [1, 2] }  -- arrays concatenated
merge({ a: { x: 1 } }, { a: { y: 2 } })      // { a: { x: 1, y: 2 } }  -- objects merged

mergeDefaults(obj, defaults1, defaults2)       // merge defaults first, obj wins
const merger = createMerger(defaults)           // reusable merger function
defu(obj, defaults1, defaults2)                // alias for mergeDefaults
```

Key behavior: `undefined` values in source objects are skipped. Later arguments take precedence in `merge()`, but the first argument takes precedence in `mergeDefaults()`/`defu()`.

## Debounce & Throttle (`debounce.ts`)

```typescript
interface DebounceOptions {
  leading?: boolean    // default: false
  trailing?: boolean   // default: true
}

const debouncedFn = debounce(fn, 300, { leading: false, trailing: true })
debouncedFn.cancel()     // cancel pending invocation
debouncedFn.flush()      // immediately invoke pending, returns result

const throttledFn = throttle(fn, 100)
throttledFn.cancel()     // cancel pending invocation

await delay(1000)        // sleep for 1 second (returns Promise<void>)
```

Note: unlike some implementations, this debounce does NOT support `maxWait`. The throttle uses `Date.now()` for timing, not setTimeout stacking.

## Color Output (`colors.ts`)

ANSI terminal color library. Auto-detects support via `process.env.NO_COLOR`, `process.env.FORCE_COLOR`, and `process.stdout.isTTY`.

### Text Colors
```typescript
black('text'), red('text'), green('text'), yellow('text')
blue('text'), magenta('text'), cyan('text'), white('text')
gray('text'), grey('text')  // grey is alias for gray
```

### Bright Text Colors
```typescript
lightRed('text'), lightGreen('text'), lightYellow('text'), lightBlue('text')
lightMagenta('text'), lightCyan('text'), lightGray('text'), lightGrey('text')
```

### Background Colors
```typescript
bgBlack('text'), bgRed('text'), bgGreen('text'), bgYellow('text')
bgBlue('text'), bgMagenta('text'), bgCyan('text'), bgWhite('text')
```

### Bright Background Colors
```typescript
bgLightRed('text'), bgLightGreen('text'), bgLightYellow('text'), bgLightBlue('text')
bgLightMagenta('text'), bgLightCyan('text')
```

### Text Formatting
```typescript
bold('text'), dim('text'), italic('text'), underline('text')
inverse('text'), hidden('text'), strikethrough('text'), reset('text')
```

### Utilities
```typescript
stripColors(coloredText)    // remove all ANSI escape codes
supportsColor()             // boolean -- is color output supported?
```

All color functions accept `string | number` and return `string`. When colors are unsupported, they return `String(text)` unchanged.

## Byte Formatting (`bytes.ts`)

```typescript
interface BytesOptions {
  precision?: number               // default: 1
  binary?: boolean                 // use KiB/MiB/GiB (default: false, uses KB/MB/GB)
  space?: boolean                  // space between number and unit (default: true)
  locale?: string                  // number formatting locale (default: 'en-US')
  minimumFractionDigits?: number   // default: 0
  maximumFractionDigits?: number   // default: precision
}

formatBytes(1024)                          // '1 KB'
formatBytes(1024, { binary: true })        // '1 KiB'
formatBytes(1234567, { precision: 2 })     // '1.23 MB'
formatBytes(-1024)                         // '-1 KB'
formatBytes(0.5)                           // '0.5 B'

parseBytes('1 KB')                         // 1000
parseBytes('1 KiB')                        // 1024
parseBytes('1.5 MB')                       // 1500000

compareBytes('1 MB', '1 GB')               // negative number (a < b)
compareBytes(1024, '1 KB')                 // 24 (a > b)

// Aliases
prettyBytes(1024)                          // alias for formatBytes
readableSize(1024)                         // alias for formatBytes
```

Units: B, KB, MB, GB, TB, PB, EB, ZB, YB (decimal) or B, KiB, MiB, GiB, TiB, PiB, EiB, ZiB, YiB (binary).

## Export Size Calculation (`size.ts`)

```typescript
interface ExportSize {
  name: string          // relative path
  size: number          // bytes
  readable: string      // human-readable
}

interface PackageExportsSizeResult {
  totalSize: number
  totalReadable: string
  exports: ExportSize[]   // sorted by size descending
}

await getFileSize('/path/to/file')          // number (bytes), returns 0 on error
const result = await getExportsSize('./dist')  // PackageExportsSizeResult
estimateGzipSize(size)                      // Math.floor(size * 0.3)
estimateBrotliSize(size)                    // Math.floor(size * 0.25)
formatExportSizes(result)                   // formatted multi-line string with table
```

`getExportsSize` scans a directory for `.js`, `.mjs`, `.cjs` files and calculates their sizes.

## Pipeline (`pipeline.ts`)

Laravel-inspired pipeline for chaining data transformations.

```typescript
type PipeFunction<T> = (data: T, next: (data: T) => T) => T
interface PipeClass<T> { handle: PipeFunction<T> }

// Array-based chaining
const result = Pipeline.send(data)
  .through([transform1, transform2, transform3])
  .via('process')       // method name on pipe classes (default: 'handle')
  .then((data) => data) // final transformation

// Fluent pipe chaining
const result2 = Pipeline.send(data)
  .pipe(fn1)
  .pipe(fn2)
  .thenReturn()         // returns data as-is after pipeline

// Pipes can be functions or objects with a handle/via method
Pipeline.send('hello')
  .through([
    (data, next) => next(data.toUpperCase()),
    (data, next) => next(data + '!'),
  ])
  .then(data => data)   // 'HELLO!'
```

Internally uses `reduceRight` so pipes execute in order (first pipe wraps outermost).

## Markdown Tables (`markdown.ts`)

```typescript
interface MarkdownTableOptions {
  align?: Array<'l' | 'c' | 'r' | 'left' | 'center' | 'right' | null>
  padding?: boolean           // default: true
  delimiter?: string          // default: '|'
  delimiterStart?: boolean    // default: true
  delimiterEnd?: boolean      // default: true
  alignDelimiter?: string     // default: '-'
}

markdownTable([
  ['Name', 'Age', 'City'],
  ['Alice', '30', 'NYC'],
  ['Bob', '25', 'LA']
])
// | Name  | Age | City |
// | ----- | --- | ---- |
// | Alice | 30  | NYC  |
// | Bob   | 25  | LA   |

markdownTable([['Left', 'Center', 'Right'], ['a', 'b', 'c']], { align: ['l', 'c', 'r'] })
// Uses :--- for left, :---: for center, ---: for right

markdownTableFromObjects([
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
])
// Auto-generates header from object keys
```

Cell values can be `string | number | boolean | null | undefined` -- all are converted to strings.

## YAML (`helpers.ts`)

Uses `Bun.YAML` natively:
```typescript
parseYaml(yamlString)     // Bun.YAML.parse(content)
loadYaml(content)         // alias for parseYaml
dumpYaml(object)          // Bun.YAML.stringify(content), falls back to JSON.stringify
```

## Macroable (`macroable.ts`)

Laravel-inspired dynamic method registration on classes.

```typescript
import { Macroable, createMacroable, macroable } from '@stacksjs/utils'

// Option 1: Extend Macroable
class MyClass extends Macroable {}

MyClass.macro('greet', function() { return 'Hello!' })
const instance = new MyClass()
;(instance as any).greet() // 'Hello!'

MyClass.hasMacro('greet')    // true
MyClass.getMacros()          // ['greet']
MyClass.flushMacros()        // remove all macros

// Mixin multiple methods from an object
MyClass.mixin({ hello() { return 'hi' }, bye() { return 'bye' } })
// replace parameter (default: true for mixin, false for macro)
MyClass.macro('greet', newFn, true)  // replace existing

// Option 2: Create macroable from existing class
const MacroClass = createMacroable(BaseClass)

// Option 3: Add macroable functionality to existing class
const Enhanced = macroable(ExistingClass)
Enhanced.macro('newMethod', fn)
```

Static methods: `macro(name, fn, replace?)`, `mixin(obj, replace?)`, `hasMacro(name)`, `flushMacros()`, `getMacros()`.

## ResizeObserver (`observer.ts`)

```typescript
isResizeObserverSupported()               // boolean
const RO = getResizeObserver()            // native or polyfill class

const cleanup = createResizeObserver(callback, element)
const cleanup2 = createResizeObserver(callback, [el1, el2])  // multiple elements
cleanup()                                  // disconnect observer

const stop = observeElementSize(element, (entry) => {
  console.log(entry.contentRect.width, entry.contentRect.height)
})
stop()                                     // stop observing
```

The polyfill uses `requestAnimationFrame` (or `setTimeout` fallback) to poll element sizes via `getBoundingClientRect()`.

## Deep Equality (`equal.ts`)

```typescript
isDeepEqual(obj1, obj2)           // deep structural equality
isDeepEqual([1, 2], [1, 2])       // true
isDeepEqual({ a: 1 }, { a: 1 })   // true
isDeepEqual(NaN, NaN)             // true (uses Object.is)
```

Compares arrays element-by-element, objects key-by-key, primitives with `Object.is`.

## Version Comparison (`versions.ts`)

Uses `Bun.semver` natively:
```typescript
const semver: typeof Bun.semver = Bun.semver

isVersionGreaterThan('2.0.0', '1.0.0')         // true
isVersionLessThan('1.0.0', '2.0.0')             // true
isVersionEqual('1.0.0', '1.0.0')                 // true
isVersionGreaterThanOrEqual('1.0.0', '1.0.0')   // true
isVersionLessThanOrEqual('1.0.0', '2.0.0')       // true

// Also exports the framework version
import { version } from '@stacksjs/utils'  // from package.json
```

## Detection Utilities (`detect.ts`)

Separate from the strings package detection -- this is the utils-specific implementation:

```typescript
interface IndentInfo {
  amount: number
  type: 'space' | 'tab' | null
  indent: string
}

detectIndent(text: string): IndentInfo
detectNewline(text: string): '\r\n' | '\n' | '\r' | null
detectNewlineGraceful(text, fallback?): '\r\n' | '\n' | '\r'  // fallback default: '\n'
normalizeNewlines(text, '\n'): string        // replace all newlines with specified type
countNewlines(text): { crlf, lf, cr, total }
```

## Project Utilities (`helpers.ts`)

```typescript
await packageManager()                    // reads from framework package.json
await frameworkVersion()                  // reads version from framework package.json
await isAppKeySet()                       // checks .env for APP_KEY with length > 16
await initProject()                       // generates application key via Action.KeyGenerate
await ensureProjectIsInitialized()        // copies .env.example if needed, checks app key
await installIfVersionMismatch()          // currently a no-op (placeholder)
await setEnvValue('KEY', 'value')         // set/update value in .env file
await runNpmScript('build', options?)     // run npm script via bun, validates script exists
hasScript(manifest, 'test')              // check if script exists in package.json manifest
determineDebugLevel(options?)             // returns true if --verbose or app.debug === true
determineResetPreset(preset?)             // returns CSS reset import array for UnoCSS
isManifest(obj)                          // type guard for package.json manifest
isOptionalString(value)                  // type guard for string | null | undefined
isIpv6(address)                          // check if AddressInfo is IPv6 (handles node >=18 quirks)
```

## Find Stacks Projects (`find.ts`)

```typescript
await findStacksProjects(dir?, options?)   // recursively search for Stacks projects
// A Stacks project = directory with 'buddy' file + 'storage/framework/core/buddy' structure
// Excludes: node_modules, dist, vendor, storage/framework, ~/Documents, ~/Pictures, ~/Library, ~/.Trash, dotfolders
```

## Git Utilities (`git.ts`)

```typescript
isGitClean(): boolean     // runs `git diff-index --quiet HEAD --`, returns true if clean
```

## Clean Project (`clean.ts`)

```typescript
await cleanProject()      // removes bun.lock, yarn.lock, node_modules, dist, cdk.out, etc.
```

## Config Builders (re-exported from `@stacksjs/config`)

```typescript
defineApp()
defineCache()
defineCdn()
defineChat()
defineCli()
defineDatabase()
defineDependencies()
defineDns()
defineEmail()
defineEmailConfig()
defineGit()
defineHashing()
defineLibrary()
defineNotification()
definePayment()
defineQueue()
defineSearchEngine()
defineServices()
defineSms()
defineFilesystems()
defineUi()
```

## Hash Utilities (`hash.ts`)

Internal cloud deployment helpers:
```typescript
originRequestFunctionHash()   // hash of cloud edge function source
websiteSourceHash()           // hash of website/docs source (depends on docMode config)
docsSourceHash()              // hash of docs source
```

## Glob (re-export)

```typescript
export { glob } from '@stacksjs/storage'
```

## Gotchas
- `merge()` concatenates arrays instead of replacing them -- this differs from spread/Object.assign behavior
- `mergeDefaults()`/`defu()` gives precedence to the FIRST argument (the object), not the defaults
- Color functions only work in terminal environments -- check `supportsColor()` first
- `debounce` does NOT support `maxWait` -- use throttle if you need guaranteed maximum delay
- `throttle.cancel()` exists but there is no `throttle.flush()`
- Pipeline uses `reduceRight` internally so pipes execute in array order, not reverse
- YAML operations use `Bun.YAML` -- `dumpYaml` falls back to `JSON.stringify` if `Bun.YAML.stringify` is unavailable
- `detectIndent` in utils (`detect.ts`) is a different, simpler implementation than the one in strings (`detect-indent.ts`)
- `isDeepEqual` uses `getTypeName` from `@stacksjs/types` for type checking
- Version comparison uses `Bun.semver.order()` which returns -1, 0, or 1
- `cleanProject()` uses `Bun.$` shell -- destructive operation that removes lock files, node_modules, and dist
