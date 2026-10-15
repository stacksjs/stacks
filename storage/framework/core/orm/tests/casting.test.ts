import { describe, expect, test } from 'bun:test'
import type { CasterInterface, CastType } from '../src/define-model'
import { builtInCasters, defineModel } from '../src/define-model'

// The real casters, imported rather than replicated.
//
// This file used to declare its own copy of the map and say that doing so
// "verifies that the casting logic in define-model.ts is correct". It did not:
// it verified the copy. The `datetime` caster read a zoneless literal with
// `new Date`, which parses as local time, so every datetime a driver returned
// as a string came back shifted by the process offset, and this suite stayed
// green throughout (stacksjs/stacks#2902).

function resolveCaster(cast: CastType | CasterInterface): CasterInterface {
  return typeof cast === 'string' ? builtInCasters[cast] : cast
}

function castAttributes(row: any, casts: Record<string, CastType | CasterInterface>, direction: 'get' | 'set'): any {
  if (!row || typeof row !== 'object') return row
  const result = { ...row }
  for (const [attr, castDef] of Object.entries(casts)) {
    if (attr in result) {
      const caster = resolveCaster(castDef)
      result[attr] = caster[direction](result[attr])
    }
  }
  return result
}

describe('ORM casting system', () => {
  describe('json cast', () => {
    test('get: parses JSON string to object', () => {
      const caster = builtInCasters.json
      expect(caster.get('{"name":"test","value":42}')).toEqual({ name: 'test', value: 42 })
    })

    test('get: returns object as-is if already parsed', () => {
      const caster = builtInCasters.json
      const obj = { name: 'test' }
      expect(caster.get(obj)).toBe(obj)
    })

    test('set: serializes object to JSON string', () => {
      const caster = builtInCasters.json
      expect(caster.set({ name: 'test', value: 42 })).toBe('{"name":"test","value":42}')
    })

    test('set: returns string as-is', () => {
      const caster = builtInCasters.json
      expect(caster.set('{"already":"json"}')).toBe('{"already":"json"}')
    })

    test('get: returns null for null input', () => {
      const caster = builtInCasters.json
      expect(caster.get(null)).toBeNull()
    })

    test('set: returns null for null input', () => {
      const caster = builtInCasters.json
      expect(caster.set(null)).toBeNull()
    })

    test('get: returns null on invalid JSON, not the unparsed string', () => {
      // The replicated map this file used to carry still returned the string,
      // which is the behaviour stacksjs/stacks#1876 O-4 removed: callers
      // checking `typeof row.config === 'object'` type-cast wrong and crashed.
      // Asserting a copy kept that expectation alive years after the real
      // caster stopped doing it.
      expect(builtInCasters.json.get('{invalid}')).toBeNull()
    })
  })

  describe('boolean cast', () => {
    test('get: converts 1 to true', () => {
      expect(builtInCasters.boolean.get(1)).toBe(true)
    })

    test('get: converts 0 to false', () => {
      expect(builtInCasters.boolean.get(0)).toBe(false)
    })

    test('get: converts "true" to true', () => {
      expect(builtInCasters.boolean.get('true')).toBe(true)
    })

    test('get: converts "false" to false', () => {
      expect(builtInCasters.boolean.get('false')).toBe(false)
    })

    test('get: converts true to true', () => {
      expect(builtInCasters.boolean.get(true)).toBe(true)
    })

    test('set: converts true to 1', () => {
      expect(builtInCasters.boolean.set(true)).toBe(1)
    })

    test('set: converts false to 0', () => {
      expect(builtInCasters.boolean.set(false)).toBe(0)
    })

    test('set: converts "true" to 1', () => {
      expect(builtInCasters.boolean.set('true')).toBe(1)
    })
  })

  describe('datetime cast', () => {
    test('get: converts ISO string to Date', () => {
      const result = builtInCasters.datetime.get('2024-06-15T10:30:00.000Z')
      expect(result).toBeInstanceOf(Date)
      expect((result as Date).toISOString()).toBe('2024-06-15T10:30:00.000Z')
    })

    test('set: writes the framework\'s canonical literal, with no Z', () => {
      // `sqlDateTime`, not `toISOString`. The trailing `Z` this used to assert
      // is what MySQL rejects in strict mode, and made the ORM the one writer
      // in the framework disagreeing with the rest (stacksjs/stacks#2902).
      const date = new Date('2024-06-15T10:30:00.000Z')
      expect(builtInCasters.datetime.set(date)).toBe('2024-06-15T10:30:00.000')
    })

    test('get: returns null for falsy value', () => {
      expect(builtInCasters.datetime.get(null)).toBeNull()
      expect(builtInCasters.datetime.get('')).toBeNull()
    })

    test('set: passes through non-Date values', () => {
      expect(builtInCasters.datetime.set('2024-06-15T10:30:00.000Z')).toBe('2024-06-15T10:30:00.000Z')
    })
  })

  describe('date cast', () => {
    test('get: converts date string to Date object', () => {
      const result = builtInCasters.date.get('2024-06-15')
      expect(result).toBeInstanceOf(Date)
    })

    test('set: converts Date to YYYY-MM-DD string', () => {
      const date = new Date('2024-06-15T10:30:00.000Z')
      expect(builtInCasters.date.set(date)).toBe('2024-06-15')
    })

    test('get: returns null for falsy value', () => {
      expect(builtInCasters.date.get(null)).toBeNull()
    })
  })

  describe('array cast', () => {
    test('get: parses JSON string to array', () => {
      expect(builtInCasters.array.get('["a","b","c"]')).toEqual(['a', 'b', 'c'])
    })

    test('get: returns array as-is', () => {
      const arr = [1, 2, 3]
      expect(builtInCasters.array.get(arr)).toBe(arr)
    })

    test('set: serializes array to JSON string', () => {
      expect(builtInCasters.array.set(['a', 'b'])).toBe('["a","b"]')
    })

    test('get: returns empty array for null', () => {
      expect(builtInCasters.array.get(null)).toEqual([])
    })

    test('set: returns null for null input', () => {
      expect(builtInCasters.array.set(null)).toBeNull()
    })

    test('get: returns empty array for invalid JSON string', () => {
      expect(builtInCasters.array.get('not-json')).toEqual([])
    })
  })

  describe('string cast', () => {
    test('get: converts number to string', () => {
      expect(builtInCasters.string.get(42)).toBe('42')
    })

    test('get: returns null for null', () => {
      expect(builtInCasters.string.get(null)).toBeNull()
    })

    test('set: converts number to string', () => {
      expect(builtInCasters.string.set(100)).toBe('100')
    })
  })

  describe('number cast', () => {
    test('get: converts string to number', () => {
      expect(builtInCasters.number.get('42')).toBe(42)
    })

    test('get: returns null for null', () => {
      expect(builtInCasters.number.get(null)).toBeNull()
    })

    test('set: converts string to number', () => {
      expect(builtInCasters.number.set('99')).toBe(99)
    })
  })

  describe('integer cast', () => {
    test('get: truncates float to integer', () => {
      expect(builtInCasters.integer.get(3.7)).toBe(3)
    })

    test('get: truncates string float to integer', () => {
      expect(builtInCasters.integer.get('5.9')).toBe(5)
    })

    test('get: returns null for null', () => {
      expect(builtInCasters.integer.get(null)).toBeNull()
    })

    test('set: truncates float on set', () => {
      expect(builtInCasters.integer.set(7.8)).toBe(7)
    })
  })

  describe('float cast', () => {
    test('get: parses string to float', () => {
      expect(builtInCasters.float.get('3.14')).toBeCloseTo(3.14)
    })

    test('get: returns null for null', () => {
      expect(builtInCasters.float.get(null)).toBeNull()
    })

    test('set: parses string to float on set', () => {
      expect(builtInCasters.float.set('2.718')).toBeCloseTo(2.718)
    })
  })

  describe('custom CasterInterface', () => {
    test('custom get and set functions work correctly', () => {
      const uppercaseCaster: CasterInterface = {
        get: (v: unknown) => typeof v === 'string' ? v.toUpperCase() : v,
        set: (v: unknown) => typeof v === 'string' ? v.toLowerCase() : v,
      }

      expect(uppercaseCaster.get('hello')).toBe('HELLO')
      expect(uppercaseCaster.set('WORLD')).toBe('world')
    })

    test('custom caster used in castAttributes', () => {
      const encryptCaster: CasterInterface = {
        get: (v: unknown) => typeof v === 'string' ? `decrypted:${v}` : v,
        set: (v: unknown) => typeof v === 'string' ? `encrypted:${v}` : v,
      }

      const row = { secret: 'my-data', name: 'test' }
      const casts: Record<string, CastType | CasterInterface> = { secret: encryptCaster }

      const getResult = castAttributes(row, casts, 'get')
      expect(getResult.secret).toBe('decrypted:my-data')
      expect(getResult.name).toBe('test')

      const setResult = castAttributes(row, casts, 'set')
      expect(setResult.secret).toBe('encrypted:my-data')
    })
  })

  describe('castAttributes with multiple casts', () => {
    test('applies multiple cast types to different attributes', () => {
      const row = {
        title: 123,
        is_active: 1,
        metadata: '{"key":"value"}',
        views: '50',
      }
      const casts: Record<string, CastType | CasterInterface> = {
        title: 'string',
        is_active: 'boolean',
        metadata: 'json',
        views: 'number',
      }

      const result = castAttributes(row, casts, 'get')
      expect(result.title).toBe('123')
      expect(result.is_active).toBe(true)
      expect(result.metadata).toEqual({ key: 'value' })
      expect(result.views).toBe(50)
    })
  })

  describe('castAttributes with non-existent attribute', () => {
    test('skips attributes not present in the row', () => {
      const row = { name: 'test' }
      const casts: Record<string, CastType | CasterInterface> = {
        name: 'string',
        missing_field: 'number',
      }

      const result = castAttributes(row, casts, 'get')
      expect(result.name).toBe('test')
      expect(result.missing_field).toBeUndefined()
    })
  })

  describe('castAttributes with null/undefined values', () => {
    test('handles null row gracefully', () => {
      const result = castAttributes(null, { name: 'string' }, 'get')
      expect(result).toBeNull()
    })

    test('handles undefined row gracefully', () => {
      const result = castAttributes(undefined, { name: 'string' }, 'get')
      expect(result).toBeUndefined()
    })

    test('handles null attribute values', () => {
      const row = { name: null, count: null }
      const casts: Record<string, CastType | CasterInterface> = {
        name: 'string',
        count: 'number',
      }

      const result = castAttributes(row, casts, 'get')
      expect(result.name).toBeNull()
      expect(result.count).toBeNull()
    })
  })

  describe('defineModel with casts integration', () => {
    test('model with casts is created successfully', () => {
      const Post = defineModel({
        name: 'Post',
        table: 'posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: { type: 'string', fillable: true },
          is_published: { type: 'boolean', fillable: true },
          metadata: { type: 'string', fillable: true },
        },
        casts: {
          is_published: 'boolean',
          metadata: 'json',
        },
      } as const)

      expect(Post._isStacksModel).toBe(true)
      expect(Post.name).toBe('Post')
      expect(typeof Post.find).toBe('function')
      expect(typeof Post.create).toBe('function')
    })

    test('model without casts still works normally', () => {
      const Post = defineModel({
        name: 'Post',
        table: 'posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: { type: 'string', fillable: true },
        },
      } as const)

      expect(Post._isStacksModel).toBe(true)
      expect(typeof Post.find).toBe('function')
    })
  })
})
