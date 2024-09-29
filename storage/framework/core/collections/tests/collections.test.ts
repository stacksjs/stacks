import { describe, expect, it } from 'bun:test'
import { Collection, collect } from '../src/index'

describe('@stacksjs/collections', () => {
  it('exports Collection and collect from collect.js', () => {
    expect(Collection).toBeDefined()
    expect(collect).toBeDefined()
  })

  describe('Collection methods', () => {
    it('all()', () => {
      const collection = collect([1, 2, 3])
      expect(collection.all()).toEqual([1, 2, 3])
    })

    it('average()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.average()).toBe(3)
    })

    it('avg()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.avg()).toBe(3)
    })

    it('chunk()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.chunk(2).all()).toEqual([[1, 2], [3, 4], [5]])
    })

    it('collapse()', () => {
      const collection = collect<number | number[]>([[1], [2, 3], [4, 5]])
      expect(collection.collapse().all()).toEqual([1, 2, 3, 4, 5])
    })

    it('combine()', () => {
      const collection = collect(['name', 'age'])
      const combined = collection.combine(['John', 25])
      expect(combined.all()).toEqual({ name: 'John', age: 25 })
    })

    it('concat()', () => {
      const collection = collect([1, 2])
      const concatenated = collection.concat([3, 4])
      expect(concatenated.all()).toEqual([1, 2, 3, 4])
    })

    it('contains()', () => {
      const collection = collect([1, 2, 3])
      expect(collection.contains(2)).toBe(true)
      expect(collection.contains(5)).toBe(false)
    })

    it('count()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.count()).toBe(5)
    })

    it('countBy()', () => {
      const collection = collect([1, 2, 2, 3, 3, 3])
      expect(collection.countBy().all()).toEqual({ '1': 1, '2': 2, '3': 3 })
    })

    it('diff()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.diff([2, 4, 6]).all()).toEqual([1, 3, 5])
    })

    it('each()', () => {
      const collection = collect([1, 2, 3])
      const result: number[] = []
      collection.each((item) => result.push(item * 2))
      expect(result).toEqual([2, 4, 6])
    })

    it('every()', () => {
      const collection = collect([2, 4, 6, 8])
      expect(collection.every((item) => item % 2 === 0)).toBe(true)
    })

    it('except()', () => {
      const collection = collect({ a: 1, b: 2, c: 3 })
      expect(collection.except(['a', 'c']).all()).toEqual({ b: 2 })
    })

    it('filter()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.filter((item) => item % 2 === 0).all()).toEqual([2, 4])
    })

    it('first()', () => {
      const collection = collect([1, 2, 3])
      expect(collection.first()).toBe(1)
    })

    it('flatMap()', () => {
      const collection = collect([1, 2, 3])
      expect(collection.flatMap((item) => [item, item * 2]).all()).toEqual([1, 2, 2, 4, 3, 6])
    })

    it('flatten()', () => {
      const collection = collect([1, [2, 3], [4, [5]]])
      expect(collection.flatten().all()).toEqual([1, 2, 3, 4, 5])
    })

    it('flip()', () => {
      const collection = collect({ a: 1, b: 2, c: 3 })
      expect(collection.flip().all()).toEqual({ '1': 'a', '2': 'b', '3': 'c' })
    })

    it('forget()', () => {
      const collection = collect({ a: 1, b: 2, c: 3 })
      expect(collection.forget('b').all()).toEqual({ a: 1, c: 3 })
    })

    it('forPage()', () => {
      const collection = collect([1, 2, 3, 4, 5, 6, 7, 8, 9])
      expect(collection.forPage(2, 3).all()).toEqual([4, 5, 6])
    })

    it('get()', () => {
      const collection = collect({ a: 1, b: 2 })
      expect(collection.get('a')).toBe(1)
      expect(collection.get('c', 'default')).toBe('default')
    })

    it('groupBy()', () => {
      const collection = collect([
        { name: 'John', age: 30 },
        { name: 'Jane', age: 28 },
        { name: 'John', age: 40 },
      ])
      const grouped = collection.groupBy('name')
      expect(grouped.get('John').count()).toBe(2)
      expect(grouped.get('Jane').count()).toBe(1)
    })

    it('has()', () => {
      const collection = collect({ a: 1, b: 2 })
      expect(collection.has('a')).toBe(true)
      expect(collection.has('c')).toBe(false)
    })

    it('implode()', () => {
      const collection = collect([1, 2, 3])
      expect(collection.implode('-')).toBe('1-2-3')
    })

    it('intersect()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.intersect([1, 3, 5, 7]).all()).toEqual([1, 3, 5])
    })

    it('isEmpty()', () => {
      expect(collect([]).isEmpty()).toBe(true)
      expect(collect([1]).isEmpty()).toBe(false)
    })

    it('isNotEmpty()', () => {
      expect(collect([]).isNotEmpty()).toBe(false)
      expect(collect([1]).isNotEmpty()).toBe(true)
    })

    it('keyBy()', () => {
      const collection = collect([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ])
      expect(collection.keyBy('id').all()).toEqual({
        '1': { id: 1, name: 'John' },
        '2': { id: 2, name: 'Jane' },
      })
    })

    it('keys()', () => {
      const collection = collect({ a: 1, b: 2, c: 3 })
      expect(collection.keys().all()).toEqual(['a', 'b', 'c'])
    })

    it('last()', () => {
      const collection = collect([1, 2, 3])
      expect(collection.last()).toBe(3)
    })

    it('map()', () => {
      const collection = collect([1, 2, 3])
      expect(collection.map((item) => item * 2).all()).toEqual([2, 4, 6])
    })

    it('max()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.max()).toBe(5)
    })

    it('median()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.median()).toBe(3)
    })

    it('merge()', () => {
      const collection = collect({ a: 1, b: 2 })
      expect(collection.merge({ b: 3, c: 4 }).all()).toEqual({ a: 1, b: 3, c: 4 })
    })

    it('min()', () => {
      const collection = collect([5, 3, 1, 2, 4])
      expect(collection.min()).toBe(1)
    })

    it('mode()', () => {
      const collection = collect([1, 2, 2, 3])
      expect(collection.mode()).toEqual([2])
    })

    it('only()', () => {
      const collection = collect({ a: 1, b: 2, c: 3 })
      expect(collection.only(['a', 'c']).all()).toEqual({ a: 1, c: 3 })
    })

    it('pad()', () => {
      const collection = collect([1, 2, 3])
      expect(collection.pad(5, 0).all()).toEqual([1, 2, 3, 0, 0])
    })

    it('partition()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const [even, odd] = collection.partition((item) => item % 2 === 0)
      expect(even.all()).toEqual([2, 4])
      expect(odd.all()).toEqual([1, 3, 5])
    })

    it('pipe()', () => {
      const collection = collect([1, 2, 3])
      const result = collection.pipe((collect) => collect.sum())
      expect(result).toBe(6)
    })

    it('pluck()', () => {
      const collection = collect([
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ])
      expect(collection.pluck('name').all()).toEqual(['John', 'Jane'])
    })

    it('pop()', () => {
      const collection = collect([1, 2, 3])
      expect(collection.pop()).toBe(3)
      expect(collection.all()).toEqual([1, 2])
    })

    it('prepend()', () => {
      const collection = collect([1, 2, 3])
      expect(collection.prepend(0).all()).toEqual([0, 1, 2, 3])
    })

    it('pull()', () => {
      const collection = collect({ a: 1, b: 2, c: 3 })
      expect(collection.pull('b')).toBe(2)
      expect(collection.all()).toEqual({ a: 1, c: 3 })
    })

    it('push()', () => {
      const collection = collect([1, 2, 3])
      collection.push(4)
      expect(collection.all()).toEqual([1, 2, 3, 4])
    })

    it('put()', () => {
      const collection = collect({ a: 1, b: 2 })
      collection.put('c', 3)
      expect(collection.all()).toEqual({ a: 1, b: 2, c: 3 })
    })

    it('random()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.all()).toContain(collection.random())
    })

    it('reduce()', () => {
      const collection = collect([1, 2, 3])
      const sum = collection.reduce((carry, item) => carry + item, 0)
      expect(sum).toBe(6)
    })

    it('reject()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.reject((item) => item % 2 === 0).all()).toEqual([1, 3, 5])
    })

    it('reverse()', () => {
      const collection = collect([1, 2, 3])
      expect(collection.reverse().all()).toEqual([3, 2, 1])
    })

    it('search()', () => {
      const collection = collect([1, 2, 3])
      expect(collection.search(2)).toBe(1)
      expect(collection.search(5)).toBe(false)
    })

    it('shift()', () => {
      const collection = collect([1, 2, 3])
      expect(collection.shift()).toBe(1)
      expect(collection.all()).toEqual([2, 3])
    })

    it('shuffle()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const shuffled = collection.shuffle()
      expect(shuffled.count()).toBe(5)
      expect(shuffled.all()).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]))
    })

    it('slice()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.slice(2).all()).toEqual([3, 4, 5])
    })

    it('sort()', () => {
      const collection = collect([3, 1, 4, 1, 5, 9, 2, 6])
      expect(collection.sort().all()).toEqual([1, 1, 2, 3, 4, 5, 6, 9])
    })

    it('sortBy()', () => {
      const collection = collect([
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
        { name: 'Bob', age: 35 },
      ])
      const sorted = collection.sortBy('age')
      expect(sorted.pluck('name').all()).toEqual(['Jane', 'John', 'Bob'])
    })

    it('splice()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const chunk = collection.splice(2, 2)
      expect(chunk.all()).toEqual([3, 4])
      expect(collection.all()).toEqual([1, 2, 5])
    })

    it('split()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const groups = collection.split(3)
      expect(groups.all()).toEqual([[1, 2], [3, 4], [5]])
    })

    it('sum()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.sum()).toBe(15)
    })

    it('take()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.take(3).all()).toEqual([1, 2, 3])
    })

    it('tap()', () => {
      const collection = collect([1, 2, 3])
      collection.tap((collection) => {
        collection.push(4)
      })
      expect(collection.all()).toEqual([1, 2, 3, 4])
    })

    it('times()', () => {
      const collection = collect().times(5, (number) => number * 2)
      expect(collection.all()).toEqual([2, 4, 6, 8, 10])
    })

    it('toArray()', () => {
      const collection = collect({ a: 1, b: 2 })
      expect(collection.toArray()).toEqual([1, 2])
    })

    it('toJson()', () => {
      const collection = collect({ a: 1, b: 2 })
      expect(collection.toJson()).toBe('{"a":1,"b":2}')
    })

    it('transform()', () => {
      const collection = collect([1, 2, 3])
      collection.transform((item) => item * 2)
      expect(collection.all()).toEqual([2, 4, 6])
    })

    it('union()', () => {
      const collection = collect({ a: 1, b: 2 })
      const union = collection.union({ b: 3, c: 4 })
      expect(union.all()).toEqual({ a: 1, b: 2, c: 4 })
    })

    it('unique()', () => {
      const collection = collect([1, 1, 2, 2, 3, 4, 5, 5])
      expect(collection.unique().all()).toEqual([1, 2, 3, 4, 5])
    })

    it('unless()', () => {
      const collection = collect([1, 2, 3])
      collection.unless(false, (c) => c.push(4))
      expect(collection.all()).toEqual([1, 2, 3, 4])
    })

    it('unlessEmpty()', () => {
      const collection = collect([1, 2, 3])
      collection.unlessEmpty((c) => c.push(4))
      expect(collection.all()).toEqual([1, 2, 3, 4])
    })

    it('unlessNotEmpty()', () => {
      const collection = collect([])
      collection.unlessNotEmpty((c) => c.push(1))
      expect(collection.all()).toEqual([1])
    })

    it('unwrap()', () => {
      expect(Collection.unwrap(collect([1, 2, 3]))).toEqual([1, 2, 3])
      expect(Collection.unwrap([1, 2, 3])).toEqual([1, 2, 3])
    })

    it('values()', () => {
      const collection = collect({ a: 1, b: 2, c: 3 })
      expect(collection.values().all()).toEqual([1, 2, 3])
    })

    it('when()', () => {
      const collection = collect([1, 2, 3])
      collection.when(true, (c) => c.push(4))
      expect(collection.all()).toEqual([1, 2, 3, 4])
    })

    it('whenEmpty()', () => {
      const collection = collect([])
      collection.whenEmpty((c) => c.push(1))
      expect(collection.all()).toEqual([1])
    })

    it('whenNotEmpty()', () => {
      const collection = collect([1, 2, 3])
      collection.whenNotEmpty((c) => c.push(4))
      expect(collection.all()).toEqual([1, 2, 3, 4])
    })

    it('where()', () => {
      const collection = collect([
        { name: 'John', age: 30 },
        { name: 'Jane', age: 20 },
        { name: 'Bob', age: 30 },
      ])
      expect(collection.where('age', 30).count()).toBe(2)
    })

    it('whereBetween()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.whereBetween('', [2, 4]).all()).toEqual([2, 3, 4])
    })

    it('whereIn()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.whereIn('', [2, 4]).all()).toEqual([2, 4])
    })

    it('whereInstanceOf()', () => {
      const collection = collect([new Date(), 'string', 123, []])
      expect(collection.whereInstanceOf(Date).count()).toBe(1)
    })

    it('whereNotBetween()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.whereNotBetween('', [2, 4]).all()).toEqual([1, 5])
    })

    it('whereNotIn()', () => {
      const collection = collect([1, 2, 3, 4, 5])
      expect(collection.whereNotIn('', [2, 4]).all()).toEqual([1, 3, 5])
    })

    it('wrap()', () => {
      expect(Collection.wrap(1).all()).toEqual([1])
      expect(Collection.wrap([1, 2, 3]).all()).toEqual([1, 2, 3])
    })

    it('zip()', () => {
      const collection = collect(['Chair', 'Desk'])
      const zipped = collection.zip([100, 200])
      expect(zipped.all()).toEqual([
        ['Chair', 100],
        ['Desk', 200],
      ])
    })
  })
})
