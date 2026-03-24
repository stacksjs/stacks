import { describe, expect, test } from 'bun:test'
import { collect } from '../src'

describe('@stacksjs/collections', () => {
  describe('map()', () => {
    test('maps values with a callback', () => {
      const result = collect([1, 2, 3]).map(x => x * 2).all()
      expect(result).toEqual([2, 4, 6])
    })

    test('map provides index as second argument', () => {
      const result = collect(['a', 'b', 'c']).map((item, i) => `${i}:${item}`).all()
      expect(result).toEqual(['0:a', '1:b', '2:c'])
    })
  })

  describe('filter()', () => {
    test('filters values by predicate', () => {
      const result = collect([1, 2, 3]).filter(x => x > 1).all()
      expect(result).toEqual([2, 3])
    })

    test('filter returns empty collection when nothing matches', () => {
      const result = collect([1, 2, 3]).filter(x => x > 10).all()
      expect(result).toEqual([])
    })
  })

  describe('first() and last()', () => {
    test('first() returns the first element', () => {
      expect(collect([1, 2, 3]).first()).toBe(1)
    })

    test('first() returns undefined for empty collection', () => {
      expect(collect([]).first()).toBeUndefined()
    })

    test('last() returns the last element', () => {
      expect(collect([1, 2, 3]).last()).toBe(3)
    })

    test('last() returns undefined for empty collection', () => {
      expect(collect([]).last()).toBeUndefined()
    })
  })

  describe('count()', () => {
    test('returns the number of items', () => {
      expect(collect([1, 2, 3]).count()).toBe(3)
    })

    test('returns 0 for empty collection', () => {
      expect(collect([]).count()).toBe(0)
    })
  })

  describe('isEmpty() and isNotEmpty()', () => {
    test('isEmpty() returns false for non-empty collection', () => {
      expect(collect([1]).isEmpty()).toBe(false)
    })

    test('isEmpty() returns true for empty collection', () => {
      expect(collect([]).isEmpty()).toBe(true)
    })

    test('isNotEmpty() returns true for non-empty collection', () => {
      expect(collect([1]).isNotEmpty()).toBe(true)
    })
  })

  describe('sum()', () => {
    test('sums numeric values', () => {
      expect(collect([1, 2, 3]).sum()).toBe(6)
    })

    test('sums by key on objects', () => {
      const items = [{ price: 10 }, { price: 20 }, { price: 30 }]
      expect(collect(items).sum('price')).toBe(60)
    })
  })

  describe('average()', () => {
    test('computes the average of numeric values', () => {
      expect(collect([1, 2, 3]).average()).toBe(2)
    })

    test('computes average by key on objects', () => {
      const items = [{ score: 80 }, { score: 90 }, { score: 100 }]
      expect(collect(items).average('score')).toBe(90)
    })
  })

  describe('pluck()', () => {
    test('plucks a single key from objects', () => {
      const items = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]
      const result = collect(items).pluck('name').all()
      expect(result).toEqual(['Alice', 'Bob'])
    })
  })

  describe('groupBy()', () => {
    test('groups items by key', () => {
      const items = [
        { category: 'fruit', name: 'apple' },
        { category: 'fruit', name: 'banana' },
        { category: 'veggie', name: 'carrot' },
      ]
      const groups = collect(items).groupBy('category')
      expect(groups.get('fruit')!.count()).toBe(2)
      expect(groups.get('veggie')!.count()).toBe(1)
    })
  })

  describe('sortBy()', () => {
    test('sorts objects by key ascending', () => {
      const items = [
        { name: 'Charlie' },
        { name: 'Alice' },
        { name: 'Bob' },
      ]
      const result = collect(items).sortBy('name').pluck('name').all()
      expect(result).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    test('sorts objects by key descending', () => {
      const items = [{ val: 1 }, { val: 3 }, { val: 2 }]
      const result = collect(items).sortBy('val', 'desc').pluck('val').all()
      expect(result).toEqual([3, 2, 1])
    })
  })

  describe('unique()', () => {
    test('removes duplicate primitives', () => {
      const result = collect([1, 2, 2, 3, 3, 3]).unique().all()
      expect(result).toEqual([1, 2, 3])
    })

    test('removes duplicates by key on objects', () => {
      const items = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 1, name: 'Alice copy' },
      ]
      const result = collect(items).unique('id').count()
      expect(result).toBe(2)
    })
  })

  describe('contains()', () => {
    test('returns true when item exists', () => {
      expect(collect([1, 2, 3]).contains(2)).toBe(true)
    })

    test('returns false when item does not exist', () => {
      expect(collect([1, 2, 3]).contains(5)).toBe(false)
    })
  })

  describe('chunk()', () => {
    test('chunks items into groups of given size', () => {
      const result = collect([1, 2, 3, 4, 5]).chunk(2).all()
      expect(result).toEqual([[1, 2], [3, 4], [5]])
    })

    test('single chunk when size exceeds length', () => {
      const result = collect([1, 2]).chunk(5).all()
      expect(result).toEqual([[1, 2]])
    })
  })

  describe('flatten()', () => {
    test('flattens nested arrays', () => {
      const result = collect([[1, 2], [3, 4], [5]]).flatten().all()
      expect(result).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('reduce()', () => {
    test('reduces to a single value', () => {
      const result = collect([1, 2, 3, 4]).reduce((acc, val) => acc + val, 0)
      expect(result).toBe(10)
    })

    test('reduce with string accumulator', () => {
      const result = collect(['a', 'b', 'c']).reduce((acc, val) => acc + val, '')
      expect(result).toBe('abc')
    })
  })

  describe('each()', () => {
    test('iterates over all items', () => {
      const seen: number[] = []
      collect([1, 2, 3]).each(item => seen.push(item))
      expect(seen).toEqual([1, 2, 3])
    })
  })

  describe('toArray()', () => {
    test('returns a plain array', () => {
      const arr = collect([1, 2, 3]).toArray()
      expect(Array.isArray(arr)).toBe(true)
      expect(arr).toEqual([1, 2, 3])
    })
  })

  describe('edge cases', () => {
    test('collect([]) creates an empty collection', () => {
      const c = collect([])
      expect(c.count()).toBe(0)
      expect(c.isEmpty()).toBe(true)
      expect(c.all()).toEqual([])
    })

    test('collect with single item', () => {
      const c = collect([42])
      expect(c.first()).toBe(42)
      expect(c.last()).toBe(42)
      expect(c.count()).toBe(1)
    })
  })

  describe('chaining', () => {
    test('filter + map + first', () => {
      const result = collect([1, 2, 3, 4, 5])
        .filter(x => x > 2)
        .map(x => x * 10)
        .first()
      expect(result).toBe(30)
    })

    test('filter + sortBy + pluck on objects', () => {
      const items = [
        { name: 'Charlie', age: 35 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 },
        { name: 'Dave', age: 20 },
      ]
      const result = collect(items)
        .filter(item => item.age >= 25)
        .sortBy('name')
        .pluck('name')
        .all()
      expect(result).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    test('map + unique + count', () => {
      const result = collect([1, 1, 2, 2, 3])
        .map(x => x * 2)
        .unique()
        .count()
      expect(result).toBe(3)
    })
  })
})
