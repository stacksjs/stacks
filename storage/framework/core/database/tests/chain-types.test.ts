// What `db`'s chain says it will answer.
//
// A type test, run by the compiler rather than at runtime: every assertion here
// is a value that only typechecks if the chain carries its row type. The reason
// it exists is that the chain used to answer `Promise<any>` from every terminal,
// and the cost of that was not theoretical - an application on top of this ends
// up writing `const row: any = await db...` a thousand times to say what it
// already knows, which is a thousand places the compiler has been told to stop
// looking.
//
// The runtime is covered by the suites beside this one. What is checked here is
// the shape of the promise, which no runtime test can see.

import type { ChainKind, FirstOf, KnownKeys, ResultOf, RowOf } from '../src/utils'
import { describe, expect, test } from 'bun:test'

/** `true` when the two types are the same, for the assertions below. */
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false

function assertType<T extends true>(_value?: T): void {}

/*
 * The framework has no application schema at its own build time, so a table it
 * has never heard of answers unknown-valued rows. That is the honest fallback:
 * still a value the caller narrows, but narrowing it is checked.
 */
type UnknownTableRow = RowOf<'a_table_no_app_declared'>

describe('a chain over an unregistered table', () => {
  test('answers rows of unknown-valued fields rather than `any`', () => {
    assertType<Same<UnknownTableRow, Record<string, unknown>>>(true)

    // The point of the whole exercise: a field read off such a row is `unknown`,
    // so `String(row.id)` is a conversion the compiler checked rather than a
    // property access it waved through.
    assertType<Same<UnknownTableRow['id'], unknown>>(true)

    expect(true).toBe(true)
  })
})

describe('what a verb answers', () => {
  test('a select resolves rows and a mutation resolves a count', () => {
    assertType<Same<ResultOf<{ id: number }, 'select'>, { id: number }[]>>(true)
    assertType<Same<ResultOf<{ id: number }, 'returning'>, { id: number }[]>>(true)
    assertType<Same<ResultOf<{ id: number }, 'update'>, number>>(true)
    assertType<Same<ResultOf<{ id: number }, 'delete'>, number>>(true)

    expect(true).toBe(true)
  })

  test('and `executeTakeFirst` follows the same rule', () => {
    assertType<Same<FirstOf<{ id: number }, 'select'>, { id: number } | undefined>>(true)
    assertType<Same<FirstOf<{ id: number }, 'update'>, { numUpdatedRows: number }>>(true)
    assertType<Same<FirstOf<{ id: number }, 'delete'>, { numDeletedRows: number }>>(true)

    /*
     * This is the distinction the old `Promise<any>` hid, and it cost real code:
     * callers read `numUpdatedRows` off a value that might have been a number,
     * and had to try three shapes to find out which they had.
     */
    expect(true).toBe(true)
  })

  test('every kind is accounted for', () => {
    // A new verb has to decide what it answers, rather than inheriting `any`.
    assertType<Same<ChainKind, 'select' | 'insert' | 'update' | 'delete' | 'returning'>>(true)

    expect(true).toBe(true)
  })
})

describe('narrowing a select list', () => {
  test('only narrows against keys a row actually declares', () => {
    // A declared row narrows.
    assertType<Same<KnownKeys<{ id: number, name: string }>, 'id' | 'name'>>(true)

    /*
     * A loose record does not, and that matters: `keyof Record<string, unknown>`
     * is `string`, so a narrowing overload written against it would accept
     * *anything* as a column - including `'users.id as id'`, which then becomes
     * a property name in the result type. A row that looks specific and is
     * fiction is worse than one that admits it does not know.
     */
    assertType<Same<KnownKeys<Record<string, unknown>>, never>>(true)

    expect(true).toBe(true)
  })
})

describe('the framework\'s own tables', () => {
  test('are typed for the framework\'s own code, without asserting them', () => {
    /*
     * The point of `FrameworkSchema`, and the whole reason this exists: the
     * framework ships these models, so `db.selectFrom('reviews')` inside a
     * framework package should answer a review - not an unknown-valued record
     * that the call site then has to assert. It used to have to, and the
     * assertions were everywhere.
     */
    assertType<Same<RowOf<'reviews'>['id'], number>>(true)

    // camelCase aliases too, because that is what a row actually carries: a
    // schema listing only one spelling is *almost* right, which typechecks until
    // somebody reads the other one.
    assertType<Same<RowOf<'pages'>['meta_description'], RowOf<'pages'>['metaDescription']>>(true)

    // And an enum column is the union it allows, so a comparison against a
    // misspelling does not compile.
    assertType<Same<RowOf<'pages'>['status'], 'draft' | 'published' | 'archived' | 'scheduled'>>(true)

    expect(true).toBe(true)
  })
})
