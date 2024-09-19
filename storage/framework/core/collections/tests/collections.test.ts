import { Collection, collect } from '../src/index'

describe('@stacksjs/collections', () => {
  it('exports Collection and collect from collect.js', () => {
    expect(Collection).toBeDefined()
    expect(collect).toBeDefined()
  })

  it('can create a collection', () => {
    const collection = collect([1, 2, 3])
    expect(collection).toBeInstanceOf(Collection)
    expect(collection.all()).toEqual([1, 2, 3])
  })

  it('can use collection methods', () => {
    const collection = collect([1, 2, 3, 4, 5])

    expect(collection.sum()).toBe(15)
    expect(collection.average()).toBe(3)
    expect(collection.map((n) => n * 2).all()).toEqual([2, 4, 6, 8, 10])
  })

  it('can chain methods', () => {
    const result = collect([1, 2, 3, 4, 5])
      .filter((n) => n % 2 === 0)
      .map((n) => n * 2)
      .all()

    expect(result).toEqual([4, 8])
  })
})
