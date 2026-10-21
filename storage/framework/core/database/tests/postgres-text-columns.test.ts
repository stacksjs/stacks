// Postgres column types for strings.
//
// Postgres stores `varchar(n)` and `text` identically and charges nothing for
// the latter, so a length the model never asked for buys no performance and
// costs correctness: the database rejects the write. `varchar(255)` is a MySQL
// idiom, where TEXT cannot be indexed without a prefix length, and it was
// being applied to every dialect that is not SQLite.
//
// See stacksjs/stacks#2965.

import { describe, expect, it } from 'bun:test'
import { mapFieldTypeToColumnType, prepareTextColumnType } from '../src/drivers/helpers'

const unbounded = { name: 'string' } as any
const bounded = (max: number) => ({
  name: 'string',
  getRules: () => [{ name: 'max', params: { max } }],
}) as any

describe('prepareTextColumnType', () => {
  it('gives Postgres text when the model declares no maximum', () => {
    expect(prepareTextColumnType(unbounded, 'postgres')).toBe('\'text\'')
  })

  it('still gives Postgres varchar when the model does declare one', () => {
    expect(prepareTextColumnType(bounded(100), 'postgres')).toBe('\'varchar(100)\'')
  })

  it('leaves MySQL on varchar(255), where TEXT cannot be indexed plainly', () => {
    expect(prepareTextColumnType(unbounded, 'mysql')).toBe('\'varchar(255)\'')
    expect(prepareTextColumnType(bounded(64), 'mysql')).toBe('\'varchar(64)\'')
  })

  it('leaves SQLite on text, which is all it has', () => {
    expect(prepareTextColumnType(unbounded, 'sqlite')).toBe('\'text\'')
    expect(prepareTextColumnType(bounded(64), 'sqlite')).toBe('\'text\'')
  })
})

describe('an attribute that declares its own column type', () => {
  // `QueryLog` declares `type: 'text'` on the six analysis columns, with a
  // comment naming the exact error Postgres raised without it, and the
  // generator read the validator only - so the declaration did nothing.
  it('is honoured over whatever the validator would have given', () => {
    expect(mapFieldTypeToColumnType(bounded(255), 'postgres', 'text')).toBe('\'text\'')
    expect(mapFieldTypeToColumnType(bounded(255), 'mysql', 'text')).toBe('\'text\'')
    expect(mapFieldTypeToColumnType(unbounded, 'sqlite', 'text')).toBe('\'text\'')
  })

  it('is ignored when it names nothing the generator understands', () => {
    expect(mapFieldTypeToColumnType(bounded(64), 'postgres', 'something-else')).toBe('\'varchar(64)\'')
  })

  it('changes nothing when the attribute declares no type', () => {
    expect(mapFieldTypeToColumnType(bounded(64), 'postgres')).toBe('\'varchar(64)\'')
    expect(mapFieldTypeToColumnType(unbounded, 'mysql')).toBe('\'varchar(255)\'')
  })
})
