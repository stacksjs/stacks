import { describe, expect, it } from 'bun:test'
import { reportFailure, resultError, resultFailed } from '../src/result'

// The mistake this file guards was made in eighty-six places across the CLI.
//
// `Result` carries `isErr` as a METHOD, so `if (result.isErr)` reads a function
// object - always truthy. Every command written that way reported failure and
// exited non-zero on every run, including the ones that did exactly what was
// asked: `buddy build:core` printed "Failed to build the Stacks core" after
// building it, and `buddy generate:migrations` exited 1 after generating them.
//
// The cost is not the exit code, which people stop looking at. It is that a
// real refusal then looks exactly like a success.

/** A Result, as the framework's own helpers build one. */
function ok(value: unknown): any {
  return { isErr: () => false, isOk: () => true, value }
}

function err(error: unknown): any {
  return { isErr: () => true, isOk: () => false, error }
}

describe('resultFailed', () => {
  /** The whole bug, in one assertion. */
  it('reads a Result method rather than the truthiness of a function', () => {
    expect(resultFailed(ok('built'))).toBe(false)
    expect(resultFailed(err(new Error('nope')))).toBe(true)
  })

  it('a successful Result is not a failure, however the code used to read it', () => {
    const result = ok('built')

    // What the old check did: a method is an object, so this was always true.
    expect(Boolean((result as any).isErr)).toBe(true)
    expect(resultFailed(result)).toBe(false)
  })

  /** Several commands build their own `{ isErr: boolean }`, and those are valid too. */
  it('reads the plain boolean shape as well', () => {
    expect(resultFailed({ isErr: false })).toBe(false)
    expect(resultFailed({ isErr: true, error: 'x' })).toBe(true)
  })

  it('anything that is not a result is not a failure', () => {
    for (const value of [null, undefined, 'ok', 42, true])
      expect(resultFailed(value), String(value)).toBe(false)
  })

  it('an object with no isErr at all is not a failure', () => {
    expect(resultFailed({ value: 'something' })).toBe(false)
  })
})

describe('resultError', () => {
  it('takes the message off an Error, which is what somebody reads', () => {
    expect(resultError(err(new Error('That branch already has commits')))).toBe('That branch already has commits')
  })

  it('takes a string error as it is', () => {
    expect(resultError(err('no key configured'))).toBe('no key configured')
  })

  it('keeps a multi-line message whole, because that is where the fix is named', () => {
    const message = 'Refusing to generate migrations:\n\n  - it would drop `version`.\n\nTry: buddy publish:model Release'

    expect(resultError(err(new Error(message)))).toBe(message)
  })

  it('falls back rather than printing "undefined"', () => {
    expect(resultError(ok('fine'))).toBe('Unknown error')
    expect(resultError(err(null), 'generateMigrations failed')).toBe('generateMigrations failed')
    expect(resultError(undefined)).toBe('Unknown error')
  })
})

describe('reportFailure', () => {
  /**
   * The logger writes asynchronously, so `log.error(message)` followed by
   * `process.exit()` loses the message: the process is gone before the write
   * lands. A command that refuses then produces an exit code and nothing else.
   */
  it('writes to stderr synchronously, so nothing is lost to the exit', () => {
    const written: string[] = []
    const stderr = process.stderr.write
    const exit = process.exit

    ;(process.stderr as any).write = (chunk: string) => {
      written.push(String(chunk))
      return true
    }
    ;(process as any).exit = (code?: number) => {
      throw new Error(`exit:${code}`)
    }

    try {
      expect(() => reportFailure({ isErr: () => true, error: new Error('would drop `version`') }))
        .toThrow('exit:1')
      expect(written.join('')).toContain('would drop `version`')
    }
    finally {
      ;(process.stderr as any).write = stderr
      ;(process as any).exit = exit
    }
  })
})
