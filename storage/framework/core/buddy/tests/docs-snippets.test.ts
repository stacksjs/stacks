// Extracting the imports out of documentation (stacksjs/stacks#2580).
//
// The extraction is what this covers. The compilation is `tsc`'s job and is
// exercised by the command itself; what can go wrong HERE is subtler - reading
// a multi-line import one line at a time reports the first line as a syntax
// error, and picking up prose that merely starts with the word `import`
// reports a failure in a paragraph.

import { describe, expect, it } from 'bun:test'
import { extractImports, findingKey, generatedTsconfig, inScope } from '../src/commands/docs/snippets'

const doc = 'docs/example.md'

describe('extractImports', () => {
  it('finds an import inside a ts block', () => {
    const found = extractImports(doc, ['# Title', '', '```ts', "import { log } from '@stacksjs/cli'", '```'].join('\n'))

    expect(found).toEqual([{ file: doc, line: 4, text: "import { log } from '@stacksjs/cli'", specifier: '@stacksjs/cli' }])
  })

  it('joins a multi-line import into one statement', () => {
    // Read a line at a time, `import {` alone is a syntax error and the report
    // would blame the documentation for the reader's own formatting.
    const found = extractImports(doc, [
      '```ts',
      'import {',
      '  log,',
      '  runCommand,',
      "} from '@stacksjs/cli'",
      '```',
    ].join('\n'))

    expect(found).toHaveLength(1)
    expect(found[0]!.specifier).toBe('@stacksjs/cli')
    expect(found[0]!.text).toContain('runCommand')
    // Reported at the line the statement STARTS on, which is where a reader
    // would look.
    expect(found[0]!.line).toBe(2)
  })

  it('handles a side-effect import', () => {
    const found = extractImports(doc, ['```ts', "import '@stacksjs/env'", '```'].join('\n'))
    expect(found[0]?.specifier).toBe('@stacksjs/env')
  })

  it('handles a type-only import', () => {
    const found = extractImports(doc, ['```ts', "import type { UserModel } from '@stacksjs/orm'", '```'].join('\n'))
    expect(found[0]?.specifier).toBe('@stacksjs/orm')
  })

  it('ignores prose outside a code block', () => {
    const found = extractImports(doc, ["import the module you need", '', '```ts', "import { a } from 'b'", '```'].join('\n'))
    expect(found).toHaveLength(1)
  })

  it('ignores blocks that are not TypeScript', () => {
    // A bash block saying `import` is not a TypeScript claim.
    const found = extractImports(doc, ['```bash', 'import-something --now', '```', '```json', '{}', '```'].join('\n'))
    expect(found).toEqual([])
  })

  it('skips a relative specifier, which cannot resolve from a document', () => {
    const found = extractImports(doc, ['```ts', "import { x } from './local'", "import { y } from '@stacksjs/cli'", '```'].join('\n'))
    expect(found.map(entry => entry.specifier)).toEqual(['@stacksjs/cli'])
  })

  it('gives up on an unterminated import rather than swallowing the document', () => {
    const found = extractImports(doc, ['```ts', 'import {', ...Array.from({ length: 20 }, () => '  more,'), '```'].join('\n'))
    expect(found).toEqual([])
  })

  it('reads several blocks in one document', () => {
    const found = extractImports(doc, [
      '```ts',
      "import { a } from '@stacksjs/cli'",
      '```',
      'Some prose.',
      '```typescript',
      "import { b } from '@stacksjs/cache'",
      '```',
    ].join('\n'))

    expect(found.map(entry => entry.specifier)).toEqual(['@stacksjs/cli', '@stacksjs/cache'])
  })
})

describe('inScope', () => {
  /**
   * The rule that keeps this from being the 187-false-positive mistake again.
   * A third-party package this repository does not install is absent for a
   * reason that has nothing to do with the documentation.
   */
  it('ignores an unresolvable third-party specifier', () => {
    expect(inScope('aws-cdk-lib', 'TS2307')).toBeFalse()
    expect(inScope('@sentry/bun', 'TS2307')).toBeFalse()
    expect(inScope('mailparser', 'TS2307')).toBeFalse()
  })

  it('reports an unresolvable FRAMEWORK specifier', () => {
    // `@stacksjs/dashboard` appeared in seven samples for a package that has
    // never existed. That is the finding worth having.
    expect(inScope('@stacksjs/dashboard', 'TS2307')).toBeTrue()
  })

  it('reports every other kind of failure, whatever the package', () => {
    // A missing export or a syntax error is about the sample, not about what
    // happens to be installed.
    expect(inScope('aws-cdk-lib', 'TS2305')).toBeTrue()
    expect(inScope('aws-cdk-lib', 'TS1005')).toBeTrue()
  })
})

describe('findingKey', () => {
  it('does not include the line number', () => {
    // Adding a paragraph above a sample would otherwise retire every baseline
    // entry below it and report the same rot as new.
    const a = findingKey({ file: 'docs/a.md', specifier: '@stacksjs/cli', message: "has no exported member 'x'." })
    const b = findingKey({ file: 'docs/a.md', specifier: '@stacksjs/cli', message: "has no exported member 'x'." })
    expect(a).toBe(b)
  })

  it('distinguishes different files, packages and messages', () => {
    const base = { file: 'docs/a.md', specifier: '@stacksjs/cli', message: 'm' }
    expect(findingKey(base)).not.toBe(findingKey({ ...base, file: 'docs/b.md' }))
    expect(findingKey(base)).not.toBe(findingKey({ ...base, specifier: '@stacksjs/cache' }))
    expect(findingKey(base)).not.toBe(findingKey({ ...base, message: 'other' }))
  })
})

/**
 * The property that broke CI once already (stacksjs/stacks#2580).
 *
 * Resolving `@stacksjs/*` through `node_modules` depends on every workspace
 * package having been BUILT. That is true on a developer machine, where stale
 * `dist` directories are lying about from earlier work, and false on a CI
 * runner that only ran `bun install` - so the first version of this reported 2
 * failures locally and 343 on CI, for packages that are perfectly fine.
 *
 * Extending the framework config maps each package to its own `src`, which is
 * there whether or not anything has been built.
 */
describe('the generated tsconfig is build-independent', () => {
  it('extends the framework config, for its source path mappings', () => {
    expect(generatedTsconfig().extends).toBe('../../tsconfig.framework.json')
  })

  it('does not extend the base config, which has no path mappings', () => {
    expect(generatedTsconfig().extends).not.toBe('../../tsconfig.base.json')
  })

  it('clears the inherited excludes', () => {
    // The framework config excludes `runtime/**`, which is where the generated
    // files are written - inheriting it compiles nothing and reports success.
    expect(generatedTsconfig().exclude).toEqual([])
  })

  it('compiles only its own generated files', () => {
    expect(generatedTsconfig().include).toEqual(['./*.ts'])
  })
})

/**
 * The second thing that broke CI (stacksjs/stacks#2580).
 *
 * The compiler is given one file per unique STATEMENT - compiling the same
 * import twice proves nothing. But the findings must map back to every
 * DOCUMENT that contains it, not just the first: attributing a shared broken
 * import to whichever document the directory walk reached first made the answer
 * depend on `readdirSync` order, which differs between macOS and Linux. Nine
 * findings then looked new on CI against a baseline that already contained
 * them, under a different filename.
 */
describe('a shared import belongs to every document that has it', () => {
  it('extracts the same statement separately from each file', () => {
    const statement = "import { dispatch } from '@stacksjs/queue'"
    const a = extractImports('docs/a.md', ['```ts', statement, '```'].join('\n'))
    const b = extractImports('docs/b.md', ['```ts', statement, '```'].join('\n'))

    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    // Same statement, different documents - and the key that a baseline is
    // matched on includes the file, so these are two distinct findings.
    expect(findingKey({ file: a[0]!.file, specifier: a[0]!.specifier, message: 'm' }))
      .not.toBe(findingKey({ file: b[0]!.file, specifier: b[0]!.specifier, message: 'm' }))
  })

  it('keeps both occurrences within one document', () => {
    // Two blocks in one file with the same import: both are reported, so
    // fixing one and leaving the other does not read as fixed.
    const found = extractImports('docs/a.md', [
      '```ts',
      "import { x } from '@stacksjs/cli'",
      '```',
      '```ts',
      "import { x } from '@stacksjs/cli'",
      '```',
    ].join('\n'))

    expect(found).toHaveLength(2)
    expect(found[0]!.line).not.toBe(found[1]!.line)
  })
})
