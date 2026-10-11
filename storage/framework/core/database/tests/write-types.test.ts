// What a write to `db` accepts.
//
// A type test, run by the compiler: every `@ts-expect-error` below is a write
// that must NOT typecheck, and the build fails if one ever starts compiling.
// The motivating bug: a seeder wrote lead stages the pipeline never uses
// (`trial_booked`), and nothing noticed because `values()` took any object.

import type { WriteOf } from '../src/utils'
import { describe, expect, test } from 'bun:test'

declare module '../src/utils' {
  interface DatabaseSchema {
    write_probe_rows: {
      columns: {
        id: number
        name: string
        stage: 'new' | 'trial'
        score: number | null
        active: number
        created_at: string
      }
    }
  }
}

type Probe = WriteOf<'write_probe_rows'>

function write(_row: Probe): void {}

describe('a write to one of the application\'s own tables', () => {
  test('takes its columns', () => {
    write({ name: 'a', stage: 'trial', score: null })
    // A boolean for a 0/1 column, a Date, and raw SQL are all fine.
    write({ active: true, created_at: new Date(), name: { raw: 'upper(name)' } })
    expect(true).toBe(true)
  })

  test('rejects a column the table does not have', () => {
    // @ts-expect-error - no such column
    write({ nmae: 'a' })
    expect(true).toBe(true)
  })

  test('rejects a value of the wrong type', () => {
    // @ts-expect-error - stage is a union, and this is not in it
    write({ stage: 'trial_booked' })
    // @ts-expect-error - score is a number
    write({ score: 'high' })
    expect(true).toBe(true)
  })
})

describe('a write to a table no model declares', () => {
  test('takes any object', () => {
    const loose: WriteOf<'a_table_no_app_declared'> = { anything: 1 }
    expect(loose).toBeTruthy()
  })
})
