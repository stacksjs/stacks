import { describe, expect, test } from 'bun:test'
import { collect } from '../src/index'

describe('Collections Integration', () => {
  test('map transforms every element', () => {
    const result = collect([1, 2, 3]).map(n => n * 2).all()
    expect(result).toEqual([2, 4, 6])
  })

  test('filter removes non-matching elements', () => {
    const result = collect([1, 2, 3, 4, 5]).filter(n => n > 3).all()
    expect(result).toEqual([4, 5])
  })

  test('map then filter chain', () => {
    const result = collect([1, 2, 3, 4, 5])
      .map(n => n * 10)
      .filter(n => n > 20)
      .all()
    expect(result).toEqual([30, 40, 50])
  })

  test('first returns the first element', () => {
    expect(collect([10, 20, 30]).first()).toBe(10)
  })

  test('last returns the last element', () => {
    expect(collect([10, 20, 30]).last()).toBe(30)
  })

  test('sum computes total', () => {
    expect(collect([1, 2, 3, 4]).sum()).toBe(10)
  })

  test('sum with key on objects', () => {
    const items = [{ price: 10 }, { price: 20 }, { price: 30 }]
    expect(collect(items).sum('price')).toBe(60)
  })

  test('avg computes average', () => {
    expect(collect([10, 20, 30]).avg()).toBe(20)
  })

  test('min and max find extremes', () => {
    const c = collect([3, 1, 4, 1, 5, 9])
    expect(c.min()).toBe(1)
    expect(c.max()).toBe(9)
  })

  test('count returns number of elements', () => {
    expect(collect([1, 2, 3]).count()).toBe(3)
    expect(collect([]).count()).toBe(0)
  })

  test('isEmpty and isNotEmpty', () => {
    expect(collect([]).isEmpty()).toBe(true)
    expect(collect([1]).isEmpty()).toBe(false)
    expect(collect([1]).isNotEmpty()).toBe(true)
  })

  test('contains checks for existence', () => {
    expect(collect([1, 2, 3]).contains(2)).toBe(true)
    expect(collect([1, 2, 3]).contains(5)).toBe(false)
  })

  test('unique removes duplicates', () => {
    const result = collect([1, 2, 2, 3, 3, 3]).unique().all()
    expect(result).toEqual([1, 2, 3])
  })

  test('sortBy sorts objects by key', () => {
    const items = [
      { name: 'Charlie', age: 30 },
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 28 },
    ]
    const sorted = collect(items).sortBy('age').all()
    expect(sorted[0].name).toBe('Alice')
    expect(sorted[1].name).toBe('Bob')
    expect(sorted[2].name).toBe('Charlie')
  })

  test('groupBy groups elements by key', () => {
    const items = [
      { dept: 'eng', name: 'Alice' },
      { dept: 'eng', name: 'Bob' },
      { dept: 'sales', name: 'Charlie' },
    ]
    const grouped = collect(items).groupBy('dept')
    const eng = grouped.get('eng')
    const sales = grouped.get('sales')
    expect(eng?.count()).toBe(2)
    expect(sales?.count()).toBe(1)
  })

  test('pluck extracts values by key', () => {
    const items = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]
    const names = collect(items).pluck('name').all()
    expect(names).toEqual(['Alice', 'Bob'])
  })

  test('reduce accumulates a value', () => {
    const sum = collect([1, 2, 3, 4]).reduce((acc, n) => acc + n, 0)
    expect(sum).toBe(10)
  })

  test('flatten flattens nested arrays', () => {
    const result = collect([[1, 2], [3, 4], [5]]).flatten().all()
    expect(result).toEqual([1, 2, 3, 4, 5])
  })

  test('chunk splits into groups', () => {
    const chunks = collect([1, 2, 3, 4, 5]).chunk(2).all()
    expect(chunks.length).toBe(3)
    expect(chunks[0]).toEqual([1, 2])
    expect(chunks[1]).toEqual([3, 4])
    expect(chunks[2]).toEqual([5])
  })

  test('each iterates over elements', () => {
    const visited: number[] = []
    collect([1, 2, 3]).each(n => visited.push(n))
    expect(visited).toEqual([1, 2, 3])
  })

  test('take returns first N items', () => {
    const result = collect([1, 2, 3, 4, 5]).take(3).all()
    expect(result).toEqual([1, 2, 3])
  })

  test('skip removes first N items', () => {
    const result = collect([1, 2, 3, 4, 5]).skip(2).all()
    expect(result).toEqual([3, 4, 5])
  })

  test('reverse reverses order', () => {
    const result = collect([1, 2, 3]).reverse().all()
    expect(result).toEqual([3, 2, 1])
  })

  test('toArray returns plain array', () => {
    const arr = collect([1, 2, 3]).toArray()
    expect(arr).toEqual([1, 2, 3])
  })

  test('where filters objects by key/value', () => {
    const items = [
      { name: 'Alice', active: true },
      { name: 'Bob', active: false },
      { name: 'Charlie', active: true },
    ]
    const active = collect(items).where('active', true).all()
    expect(active.length).toBe(2)
    expect(active[0].name).toBe('Alice')
    expect(active[1].name).toBe('Charlie')
  })

  test('complex chain: filter, map, sort, take', () => {
    const data = [
      { name: 'Alice', score: 85 },
      { name: 'Bob', score: 92 },
      { name: 'Charlie', score: 78 },
      { name: 'Diana', score: 95 },
      { name: 'Eve', score: 88 },
    ]
    const topScorers = collect(data)
      .filter(s => s.score >= 85)
      .sortByDesc('score')
      .take(2)
      .pluck('name')
      .all()
    expect(topScorers).toEqual(['Diana', 'Bob'])
  })
})
