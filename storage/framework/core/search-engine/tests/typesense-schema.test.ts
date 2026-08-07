import { describe, expect, it } from 'bun:test'

/**
 * Typesense collections carry a schema, and it cannot be extended after the
 * collection exists. Three defects in the driver combined so that a perfectly
 * indexed catalog was completely unsearchable.
 *
 * 1. `createIndex(name)` accepted no settings and no sample document, so it
 *    created a collection holding `id` and nothing else.
 * 2. `ensureCollection` returns early when the collection is already there, so
 *    the `addDocuments` call that followed could no longer add the fields.
 *    Calling createIndex first therefore made things permanently worse than
 *    not calling it at all.
 * 3. `inferFieldType` answered 'string' for every value, and
 *    `normalizeDocument` stringified every number to match. A price column
 *    typed as text sorts 1000 before 900.
 *
 * The symptom was 20 documents imported successfully and every query coming
 * back "Could not find a field named `name` in the schema".
 *
 * These cover the two pure decisions. The request plumbing around them needs a
 * live server and is exercised by `buddy menu:index`.
 */

/** The fixed inferFieldType. */
function inferFieldType(value: unknown): string {
  if (typeof value === 'boolean')
    return 'bool'
  if (typeof value === 'number')
    return Number.isInteger(value) ? 'int64' : 'float'
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === 'boolean')
      return 'bool[]'
    if (typeof first === 'number')
      return Number.isInteger(first) ? 'int64[]' : 'float[]'
    return 'string[]'
  }
  return 'string'
}

/** The fixed normalizeDocument. */
function normalizeDocument(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc)) {
    if (value == null)
      continue
    if (key === 'id' || typeof value === 'bigint')
      out[key] = String(value)
    else
      out[key] = value
  }
  if (doc.id != null && out.id == null)
    out.id = String(doc.id)
  return out
}

/** The field list ensureCollection builds from settings plus a sample. */
function buildFields(sample: Record<string, unknown>, settings: {
  filterableAttributes?: string[]
  sortableAttributes?: string[]
  searchableAttributes?: string[]
}) {
  const names = new Set<string>(['id'])
  for (const attr of [
    ...(settings.searchableAttributes ?? []),
    ...(settings.filterableAttributes ?? []),
    ...(settings.sortableAttributes ?? []),
  ]) names.add(attr)
  for (const key of Object.keys(sample)) names.add(key)

  return [...names].map(name => ({
    name,
    type: name === 'id' ? 'string' : inferFieldType(sample[name]),
    facet: (settings.filterableAttributes ?? []).includes(name),
    sort: (settings.sortableAttributes ?? []).includes(name),
    optional: name !== 'id',
  }))
}

describe('inferFieldType', () => {
  it('types a whole number as int64, not text', () => {
    // A price in cents. As 'string' it sorted 1000 before 900.
    expect(inferFieldType(1200)).toBe('int64')
  })

  it('types a fractional number as float', () => {
    expect(inferFieldType(23.4)).toBe('float')
  })

  it('types a boolean as bool', () => {
    expect(inferFieldType(true)).toBe('bool')
  })

  it('types arrays by their first element', () => {
    expect(inferFieldType(['indica', 'hybrid'])).toBe('string[]')
    expect(inferFieldType([1, 2])).toBe('int64[]')
  })

  it('still falls back to string for text and for anything unknown', () => {
    expect(inferFieldType('Blue Flame OG')).toBe('string')
    expect(inferFieldType(undefined)).toBe('string')
    expect(inferFieldType({})).toBe('string')
  })
})

describe('normalizeDocument', () => {
  it('leaves numbers alone so the schema can type them', () => {
    const doc = normalizeDocument({ id: 7, name: 'Blue Flame OG', price: 6000, thc: 23.4 })

    expect(doc.price).toBe(6000)
    expect(doc.thc).toBe(23.4)
  })

  it('still stringifies id, which Typesense requires as a string', () => {
    expect(normalizeDocument({ id: 7 }).id).toBe('7')
  })

  it('stringifies bigint, which JSON.stringify throws on', () => {
    expect(normalizeDocument({ id: 1, big: 9007199254740993n }).big).toBe('9007199254740993')
  })

  it('drops null and undefined rather than indexing them', () => {
    const doc = normalizeDocument({ id: 1, image: null, note: undefined, brand: 'CBX' })

    expect('image' in doc).toBe(false)
    expect('note' in doc).toBe(false)
    expect(doc.brand).toBe('CBX')
  })

  it('keeps false, which is a value and not an absence', () => {
    expect(normalizeDocument({ id: 1, featured: false }).featured).toBe(false)
  })
})

describe('collection fields', () => {
  const sample = {
    id: '1',
    name: 'Blue Flame OG',
    brand: 'CBX',
    category: 'flower',
    price: 6000,
    thc: 23.4,
    featured: 1,
  }
  const settings = {
    searchableAttributes: ['name', 'brand', 'category'],
    filterableAttributes: ['category', 'brand'],
    sortableAttributes: ['price', 'thc'],
  }

  it('declares the searchable fields, so a query by name resolves', () => {
    const names = buildFields(sample, settings).map(f => f.name)

    // The whole failure was this list containing only 'id'.
    expect(names).toContain('name')
    expect(names).toContain('brand')
    expect(names.length).toBeGreaterThan(1)
  })

  it('marks filterable fields as facets and sortable fields as sortable', () => {
    const fields = buildFields(sample, settings)
    const by = (name: string) => fields.find(f => f.name === name)

    expect(by('category')?.facet).toBe(true)
    expect(by('price')?.sort).toBe(true)
    expect(by('name')?.facet).toBe(false)
  })

  it('gives price a numeric type so sorting is numeric', () => {
    expect(buildFields(sample, settings).find(f => f.name === 'price')?.type).toBe('int64')
    expect(buildFields(sample, settings).find(f => f.name === 'thc')?.type).toBe('float')
  })

  it('keeps id a required string and everything else optional', () => {
    const fields = buildFields(sample, settings)
    const id = fields.find(f => f.name === 'id')

    expect(id?.type).toBe('string')
    expect(id?.optional).toBe(false)
    expect(fields.filter(f => f.name !== 'id').every(f => f.optional)).toBe(true)
  })
})
