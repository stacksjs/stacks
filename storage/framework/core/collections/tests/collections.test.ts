import { beforeAll, describe, expect, it, spyOn } from 'bun:test'
import { collect, Collection } from '../src/index'

describe('@stacksjs/collections', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test'
  })

  it('exports Collection and collect from collect.js', () => {
    expect(Collection).toBeDefined()
    expect(collect).toBeDefined()
  })

  describe('all() method', () => {
    it('should return all items, simple array', () => {
      expect(collect([1, 2, 3, 4, 5]).all()).toEqual([1, 2, 3, 4, 5])
    })

    it('should recursively return all items', () => {
      const collectionOfCollections = collect([
        collect([1, 2, 3]),
        collect([4, 5, 6, collect([7, 8, 9]), [10, 11, 12]]),
      ])

      expect(collectionOfCollections.all()).toEqual([
        collect([1, 2, 3]),
        collect([4, 5, 6, collect([7, 8, 9]), [10, 11, 12]]),
      ])
    })

    it('should return all items when collection is an object', () => {
      const collection = collect({
        name: 'Darwin Núñez',
      })

      expect(collection.all()).toEqual({ name: 'Darwin Núñez' })
    })

    it('should return all items when containing objects', () => {
      const collection = collect({
        name: {
          first: 'Darwin',
          last: 'Núñez',
        },
      })

      expect(collection.all()).toEqual({
        name: {
          first: 'Darwin',
          last: 'Núñez',
        },
      })
    })

    it('should return all items containing functions', () => {
      const collection = collect({
        fn: () => 2 + 2,
      })

      const all = collection.all()
      expect(all).toHaveProperty('fn')
      expect(all.fn).toBeInstanceOf(Function)
      expect(all.fn()).toBe(4)
    })
  })

  describe('average() method', () => {
    const products = [
      { name: 'Chair', price: 600 },
      { name: 'Desk', price: 900 },
      { name: 'Lamp', price: 150 },
    ]

    it('should return the average value of collection values', () => {
      expect(collect([1, 3, 3, 7]).average()).toEqual(3.5)
    })

    it('should accept a callback function', () => {
      const avg = collect(products).average((product: any) => product.price)
      expect(avg).toEqual(550)
    })

    it('should return the average value of collection values by key', () => {
      const collection = collect(products)
      const avg = collection.average('price')
      expect(avg).toEqual(550)
      expect(collection.all()).toEqual(products)
    })
  })

  describe('avg() method', () => {
    const products = [
      { name: 'Chair', price: 600 },
      { name: 'Desk', price: 900 },
      { name: 'Lamp', price: 150 },
    ]

    it('should return the average value of collection values', () => {
      expect(collect([1, 3, 3, 7]).avg()).toEqual(3.5)
    })

    it('avg is an alias for the average method', () => {
      expect(collect([1, 3, 3, 7]).avg()).toEqual(3.5)
      expect(collect([1, 3, 3, 7]).unique().avg()).toEqual(3.6666666666666665)
    })

    it('should return the average value of collection values by key', () => {
      const collection = collect(products)
      const avg = collection.avg('price')
      expect(avg).toEqual(550)
      expect(collection.all()).toEqual(products)
    })
  })

  describe('chunk() method', () => {
    it('should break the collection into multiple collections of a given size', () => {
      const collection = collect([
        { product: 'Desk', price: 200, manufacturer: 'IKEA' },
        { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
        { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
        { product: 'Door', price: '100' },
      ])

      const chunksOf1 = collection.chunk(1)
      expect(chunksOf1.all()).toEqual([
        [{ product: 'Desk', price: 200, manufacturer: 'IKEA' }],
        [{ product: 'Chair', price: 100, manufacturer: 'Herman Miller' }],
        [{ product: 'Bookcase', price: 150, manufacturer: 'IKEA' }],
        [{ product: 'Door', price: '100' }],
      ])
    })

    it('should return a new collection, not modify the original', () => {
      const collection = collect([1, 2, 3, 4])
      const chunks = collection.chunk(1)

      expect(chunks.all()).toEqual([[1], [2], [3], [4]])
    })

    it('should return a new collection, not modify the original', () => {
      const collection = collect([1, 2, 3, 4])
      const chunks = collection.chunk(1)

      expect(chunks.all()).toEqual([collect([1]), collect([2]), collect([3]), collect([4])])

      expect(collection.all()).toEqual([1, 2, 3, 4])
      expect(chunks).not.toEqual(collection)
    })

    it('should also work when the collection is based on an object', () => {
      const collection = collect({
        name: 'Jürgen Klopp',
        club: 'Liverpool FC',
      })

      const chunks = collection.chunk(1)

      expect(chunks.all()).toEqual([
        collect({
          name: 'Jürgen Klopp',
        }),
        collect({
          club: 'Liverpool FC',
        }),
      ])

      expect(collection.all()).toEqual({
        name: 'Jürgen Klopp',
        club: 'Liverpool FC',
      })
    })

    it('should also work with strings, numbers etc.', () => {
      expect(collect('LFC').chunk(1).first()).toEqual(['LFC'])
      expect(collect(1234).chunk(1).first()).toEqual([1234])
      expect(collect(true).chunk(1).first()).toEqual([true])
    })
  })

  describe('collapse() method', () => {
    it('should collapse a collection of arrays into a flat collection', () => {
      const collection = collect([[1], [{ name: 'Daniel' }, 5], ['xoxo']])
      const collapsed = collection.collapse()

      expect(collapsed.all()).toEqual([1, { name: 'Daniel' }, 5, 'xoxo'])
    })
  })

  describe('combine() method', () => {
    it('should combine the keys of the collection with the values of another array', () => {
      const collection = collect(['name', 'number'])
      const combine = collection.combine(['Steven Gerrard', 8])

      expect(combine.all()).toEqual({
        name: 'Steven Gerrard',
        number: 8,
      })
      expect(collection.all()).toEqual(['name', 'number'])
    })

    it('should work when the collection is a string', () => {
      const collection = collect('name')
      const combine = collection.combine('Steven Gerrard')
      const combine2 = collection.combine(['Darwin Núñez'])

      expect(combine.all()).toEqual({ name: 'Steven Gerrard' })
      expect(combine2.all()).toEqual({ name: 'Darwin Núñez' })
      expect(collection.all()).toEqual(['name'])
    })

    it('should be able to combine with a string', () => {
      const collection = collect(['name', 'number'])
      const combine = collection.combine('Joël Matip')

      expect(combine.all()).toEqual({ name: 'Joël Matip' })
      expect(collection.all()).toEqual(['name', 'number'])
    })

    it('should be able to combine with the values of an object', () => {
      const collection = collect(['name', 'shortName'])
      const combine = collection.combine({ o: 'Liverpool FC', x: 'LFC' })

      expect(combine.all()).toEqual({
        name: 'Liverpool FC',
        shortName: 'LFC',
      })

      expect(collection.all()).toEqual(['name', 'shortName'])
    })

    it('should be able to combine with a collection', () => {
      const collection = collect('name')
      const combine = collection.combine(collect('Roberto Firmino'))

      expect(combine.all()).toEqual({ name: 'Roberto Firmino' })
      expect(collection.all()).toEqual(['name'])
    })
  })

  describe('concat() method', () => {
    it('should append arrays to collection', () => {
      const expected = [4, 5, 6, 'a', 'b', 'c', 'Jonny', 'from', 'Laroe', 'Jonny', 'from', 'Laroe']

      const firstCollection = collect([4, 5, 6])
      const firstArray = ['a', 'b', 'c']
      const secondArray = [
        {
          who: 'Jonny',
        },
        {
          preposition: 'from',
        },
        {
          where: 'Laroe',
        },
      ]
      const firstObj = {
        who: 'Jonny',
        preposition: 'from',
        where: 'Laroe',
      }

      const collection = firstCollection.concat(firstArray).concat(secondArray).concat(firstObj)

      expect(collection.count()).toEqual(12)
      expect(collection.all()).toEqual(expected)
    })

    it('should append collections to collection', () => {
      const expected = [4, 5, 6, 'a', 'b', 'c', 'Jonny', 'from', 'Laroe', 'Jonny', 'from', 'Laroe']

      let collection = collect([4, 5, 6])
      collection = collection.concat(collect(['a', 'b', 'c']))
      collection = collection.concat(
        collect([
          {
            who: 'Jonny',
          },
          {
            preposition: 'from',
          },
          {
            where: 'Laroe',
          },
        ]),
      )

      collection = collection.concat([
        {
          who: 'Jonny',
        },
        {
          preposition: 'from',
        },
        {
          where: 'Laroe',
        },
      ])

      expect(collection.count()).toEqual(12)
      expect(collection.all()).toEqual(expected)
    })

    it('should not modify the collection', () => {
      const arr1 = collect([1, 2, 3])
      const arr2 = arr1.concat([4, 5])

      expect(arr1.all()).toEqual([1, 2, 3])
      expect(arr2.all()).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('contains() method', () => {
    it('should return whether the collection contains a given item', () => {
      const collection = collect({
        name: 'Steven Gerrard',
        number: 8,
      })

      const contains = collection.contains('name')

      expect(contains).toEqual(true)

      expect(collection.all()).toEqual({
        name: 'Steven Gerrard',
        number: 8,
      })

      const collection2 = collect({
        name: 'Steven Gerrard',
        number: 8,
      })

      const contains2 = collection2.contains('spouse')
      expect(contains2).toEqual(false)
      expect(collection2.all()).toEqual({
        name: 'Steven Gerrard',
        number: 8,
      })
    })

    it('should accept a key / value pair', () => {
      const collection = collect({
        name: 'Steven Gerrard',
        number: 8,
      })

      const contains = collection.contains('name', 'Steven Gerrard')
      expect(contains).toEqual(true)

      const contains2 = collection.contains('number', '8')
      expect(contains2).toEqual(false)

      const contains3 = collection.contains('number', 28)
      expect(contains3).toEqual(false)

      const contains4 = collection.contains('name', 'Steve Jobs')
      expect(contains4).toEqual(false)
    })

    it('should work with an collection with an array of objects', () => {
      const collection = collect([
        {
          name: 'Steven Gerrard',
          number: 8,
        },
        {
          name: 'Steve Jobs',
          number: 2,
        },
      ])

      expect(collection.contains('name')).toEqual(false)
      expect(collection.contains('name', 'Steven Gerrard')).toEqual(true)
      expect(collection.contains('name', 'Gerrard')).toEqual(false)
    })

    it('should accept a closure', () => {
      const collection = collect([1, 2, 3, 4, 5])

      const contains = collection.contains(value => value > 5)
      expect(contains).toEqual(false)

      const contains2 = collection.contains(value => value < 5)
      expect(contains2).toEqual(true)

      const collection3 = collect([1, 2, 3, 4])
      expect(collection3.contains(4)).toEqual(true)
    })

    it('should return whether the collection contains a given key', () => {
      const collection = collect({
        name: 'Mohamed Salah',
        number: 11,
      })

      expect(collection.contains('name')).toEqual(true)
      expect(collection.contains('Mohamed Salah')).toEqual(true)
      expect(collection.contains('number')).toEqual(true)
      expect(collection.contains(11)).toEqual(true)
    })
  })

  describe('containsOneItem() method', () => {
    it('should test if collection contains one item', () => {
      expect(collect().containsOneItem()).toEqual(false)
      expect(collect([]).containsOneItem()).toEqual(false)
      expect(collect({}).containsOneItem()).toEqual(false)

      expect(collect([1]).containsOneItem()).toEqual(true)
      expect(collect('').containsOneItem()).toEqual(true)
      expect(collect('xo').containsOneItem()).toEqual(true)
      expect(collect(['']).containsOneItem()).toEqual(true)
      expect(collect('a', 'b').containsOneItem()).toEqual(true)
      expect(collect('value').containsOneItem()).toEqual(true)
      expect(collect(['value']).containsOneItem()).toEqual(true)
      expect(collect({ key: 'value' }).containsOneItem()).toEqual(true)

      expect(collect([1, 2, 3]).containsOneItem()).toEqual(false)
      expect(collect({ key: 'value', value: 'key' }).containsOneItem()).toEqual(false)
      expect(collect([{ key: 'value' }, { key: 'value' }]).containsOneItem()).toEqual(false)
    })
  })

  describe('count() method', () => {
    it('should return the count of the collection', () => {
      expect(collect([1, 2, 3, 4]).count()).toEqual(4)
      expect(collect([1, 2, 3, 4, 5]).count()).toEqual(5)
      expect(collect([1, 2, 3, 4, 5, 6]).count()).toEqual(6)
      expect(collect([1, 2, 3, 4, 5, 6, 7]).count()).toEqual(7)
    })

    it('should return the number of items on an object', () => {
      expect(collect({ name: 'Darwin Núñez' }).count()).toEqual(1)
      expect(collect({ name: 'Darwin Núñez', number: 27 }).count()).toEqual(2)
      expect(collect({ name: 'Darwin Núñez', number: 27, club: 'Liverpool FC' }).count()).toEqual(3)
    })

    it('should return the number of items on an array of objects', () => {
      const array = []
      array.name = 'Abdullah AlGethami'

      expect(collect(array).count()).toEqual(1)
      array.age = '30'
      expect(collect(array).count()).toEqual(2)
      array.gender = 'male'
      expect(collect(array).count()).toEqual(3)
    })

    it('should return the number of items on mixed values', () => {
      const array = [1, 2, 3]
      array.name = 'Abdullah AlGethami'

      expect(collect(array).count()).toEqual(4)
      array.age = '30'
      expect(collect(array).count()).toEqual(5)
      array.gender = 'male'
      expect(collect(array).count()).toEqual(6)
    })
  })

  describe('countBy() method', () => {
    it('should count string occurrences', () => {
      const collection = collect(['foo', 'foo', 'foo', 'bar', 'bar', 'foobar'])

      expect(collection.countBy().all()).toEqual({
        foo: 3,
        bar: 2,
        foobar: 1,
      })
    })

    it('should count boolean occurrences', () => {
      const collection = collect([true, true, false, false, false])

      expect(collection.countBy().all()).toEqual({
        true: 2,
        false: 3,
      })
    })

    it('should count integer occurrences', () => {
      const collection = collect([1, 5, 1, 5, 5, 1])

      expect(collection.countBy().all()).toEqual({
        1: 3,
        5: 3,
      })
    })

    it('should count occurrences based on the closure', () => {
      const collection = collect(['alice', 'aaron', 'bob', 'carla'])

      expect(collection.countBy(value => value[0]).all()).toEqual({
        a: 2,
        b: 1,
        c: 1,
      })

      const collection2 = collect(['alice@gmail.com', 'bob@yahoo.com', 'carlos@gmail.com'])

      const counted = collection2.countBy(email => email.split('@')[1])

      expect(counted.all()).toEqual({
        'gmail.com': 2,
        'yahoo.com': 1,
      })
    })
  })

  describe('crossJoin() method', () => {
    it('should cross join with the given lists, returning all possible permutations', () => {
      const crossJoin1 = collect([1, 2]).crossJoin(['a', 'b'])
      expect(crossJoin1.all()).toEqual([
        [1, 'a'],
        [1, 'b'],
        [2, 'a'],
        [2, 'b'],
      ])

      const crossJoin2 = collect([1, 2]).crossJoin(collect(['a', 'b']))
      expect(crossJoin2.all()).toEqual([
        [1, 'a'],
        [1, 'b'],
        [2, 'a'],
        [2, 'b'],
      ])

      const crossJoin3 = collect([1, 2]).crossJoin(collect(['a', 'b']), ['I', 'II'])
      expect(crossJoin3.all()).toEqual([
        [1, 'a', 'I'],
        [1, 'a', 'II'],
        [1, 'b', 'I'],
        [1, 'b', 'II'],
        [2, 'a', 'I'],
        [2, 'a', 'II'],
        [2, 'b', 'I'],
        [2, 'b', 'II'],
      ])

      const crossJoin4 = collect([1, 2]).crossJoin(['a', 'b'], ['I', 'II'])
      expect(crossJoin4.all()).toEqual([
        [1, 'a', 'I'],
        [1, 'a', 'II'],
        [1, 'b', 'I'],
        [1, 'b', 'II'],
        [2, 'a', 'I'],
        [2, 'a', 'II'],
        [2, 'b', 'I'],
        [2, 'b', 'II'],
      ])
    })
  })

  describe('dd() method', () => {
    it('should dump the collection and exit the current process', () => {
      const collection = collect([1, 2, 3])
      const mockConsole = spyOn(console, 'log').mockImplementation(() => {})
      const mockProcess = spyOn(process, 'exit').mockImplementation(() => {})

      collection.dd()

      expect(mockConsole).toHaveBeenCalledWith(JSON.stringify(collection.all(), null, 2))
      expect(mockProcess).toHaveBeenCalled()

      mockConsole.mockRestore()
      mockProcess.mockRestore()
    })
  })

  describe('dump() method', () => {
    it('should console log the collection', () => {
      const spy = spyOn(console, 'log').mockImplementation(() => {})

      collect([1, 2, 3, 4, 5]).dump()
      collect({ name: 'Darwin Núñez', number: 27 }).dump()

      expect(spy).toHaveBeenCalledWith([1, 2, 3, 4, 5])
      expect(spy).toHaveBeenCalledWith({ name: 'Darwin Núñez', number: 27 })

      spy.mockRestore()
    })
  })

  describe('diff() method', () => {
    it('should return the missing values from collection', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const diff = collection.diff([1, 2, 3, 9])

      expect(diff.all()).toEqual([4, 5])
      expect(collection.all()).toEqual([1, 2, 3, 4, 5])
    })

    it('should accept a collection as an argument', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const diffCollection = collect([1, 2, 3, 9])

      const diff = collection.diff(diffCollection)

      expect(diff.all()).toEqual([4, 5])
    })
  })

  describe('diffAssoc() method', () => {
    it('should get the items in the collection whose keys and values are not present in the given items', () => {
      const collection1 = collect({ id: 1, first_word: 'Hello', not_affected: 'value' })
      const collection2 = collect({ id: 123, foo_bar: 'Hello', not_affected: 'value' })

      expect({ id: 1, first_word: 'Hello' }).toEqual(collection1.diffAssoc(collection2).all())

      const collection3 = collect({
        color: 'orange',
        type: 'fruit',
        remain: 6,
      })

      const collection4 = collection3.diffAssoc({
        color: 'yellow',
        type: 'fruit',
        remain: 3,
        used: 6,
      })

      expect(collection4.all()).toEqual({ color: 'orange', remain: 6 })
    })
  })

  describe('diffKeys() method', () => {
    const data = {
      a: 'a',
      b: 'b',
      c: 'c',
      d: 'd',
    }

    const diff = {
      b: 'b',
      d: 'd',
    }

    it('should compare the collection against a plain JavaScript object based on its keys', () => {
      const collection = collect(data)
      const difference = collection.diffKeys(diff)

      expect(difference.all()).toEqual({ a: 'a', c: 'c' })
      expect(collection.all()).toEqual(data)
    })

    it('should compare the collection against another collection based on its keys', () => {
      const collection = collect(data)
      const diffCollection = collect(diff)

      const difference = collection.diffKeys(diffCollection)
      expect(difference.all()).toEqual({ a: 'a', c: 'c' })
    })
  })

  describe('diffUsing() method', () => {
    it('should compare the collection against a javascript array using a callback', () => {
      const collection = collect(['fr', 'en_gb', 'hr'])
      const diffArray = ['en_gb', 'hr']

      const diff = collection.diffUsing(diffArray, (a, b) => a.localeCompare(b))

      expect(diff.all()).toEqual(['fr'])
      expect(collection.all()).toEqual(['fr', 'en_gb', 'hr'])
    })

    it('should compare with null', () => {
      const collection = collect([1, 2, 3])
      const diff = collection.diffUsing(null, (a, b) => a - b)

      expect(diff.all()).toEqual([1, 2, 3])
    })

    it('should compare the collection against a javascript array using a callback', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const array = [2, 3, 4, 5, 6]

      // eslint-disable-next-line no-console
      console.log('Collection:', collection.all())
      // eslint-disable-next-line no-console
      console.log('Array:', array)

      const diff = collection.diffUsing(array, (a, b) => {
        // eslint-disable-next-line no-console
        console.log('Comparing:', a, b)
        return a === b
      })

      // eslint-disable-next-line no-console
      console.log('Diff result:', diff.all())

      expect(diff.all()).toEqual([1])
    })

    it('does not return a difference when the comparison is null', () => {
      const collection = collect(['apple', 'banana', 'cherry'])
      // eslint-disable-next-line no-console
      console.log('Initial collection:', collection.all())

      const diff = collection.diffUsing(null, (a, b) => {
        // eslint-disable-next-line no-console
        console.log('Comparing:', a, 'with', b)
        return a.localeCompare(b)
      })

      // eslint-disable-next-line no-console
      console.log('Resulting diff:', diff.all())

      expect(diff.all()).toEqual(['apple', 'banana', 'cherry'])
    })

    it('does not return a difference when the comparison is null', () => {
      const collection = collect(['apple', 'banana', 'cherry'])
      const diff = collection.diffUsing(null, (a, b) => a.localeCompare(b))

      expect(diff.all()).toEqual(['apple', 'banana', 'cherry'])
    })
  })

  describe('doesntContain() method', () => {
    it('should return true if the collection doesnt contain the item', () => {
      const collection = collect([1, 2, 3])

      expect(collection.doesntContain(3)).toEqual(false)
      expect(collection.doesntContain(4)).toEqual(true)
    })

    it('should accept a callback', () => {
      const collection = collect([1, 2, 3, 4, 5])

      const doesntContain = collection.doesntContain(value => value < 5)

      expect(doesntContain).toEqual(false)
    })

    it('should work with object based collection', () => {
      const collection = collect({
        name: 'Desk',
        price: 100,
      })

      expect(collection.doesntContain('Table')).toEqual(true)
      expect(collection.doesntContain('Desk')).toEqual(false)
    })

    it('should accept key value pairs', () => {
      const collection = collect([
        {
          product: 'Desk',
          price: 200,
        },
        {
          product: 'Chair',
          price: 100,
        },
      ])

      expect(collection.doesntContain('product', 'Bookcase')).toEqual(true)
      expect(collection.doesntContain('product', 'Desk')).toEqual(false)
    })
  })

  describe('duplicates() method', () => {
    it('should find duplicates in array', () => {
      const collection = collect([1, 2, 1, 'stacks', null, 'stacks', 'ts', null])

      expect(collection.duplicates().all()).toEqual({
        2: 1,
        5: 'stacks',
        7: null,
      })
    })

    it('should find duplicates in objects', () => {
      const collection = collect({
        name: 'Fabinho',
        nickname: 'Fabinho',
      })

      expect(collection.duplicates().all()).toEqual({
        nickname: 'Fabinho',
      })
    })

    it('should find duplicates in array with mixed primitives', () => {
      const collection = collect([2, 2, ['collect.js'], ['collect.js'], collect([1, 2, 3]), collect([1, 2, 3])])

      expect(collection.duplicates().all()).toEqual({
        1: 2,
        3: ['collect.js'],
        5: collect([1, 2, 3]),
      })
    })

    it('should not find duplicates when passing nothing', () => {
      const collection = collect()

      expect(collection.duplicates().all()).toEqual({})
    })

    it('should not find duplicates when passing an empty array', () => {
      const collection = collect([])

      expect(collection.duplicates().all()).toEqual({})
    })

    it('should not find duplicates when passing null', () => {
      const collection = collect(null)

      expect(collection.duplicates().all()).toEqual({})
    })

    it('should not find duplicates when passing a string', () => {
      const collection = collect('this is my string')

      expect(collection.duplicates().all()).toEqual({})
    })
  })

  describe('each() method', () => {
    it('should iterate over the collection', () => {
      let sum = 0

      const collection = collect([1, 3, 3, 7])

      const each = collection
        .each((item) => {
          sum += item
        })
        .all()

      expect(each).toEqual([1, 3, 3, 7])
      expect(sum).toEqual(14)
      expect(collection.all()).toEqual([1, 3, 3, 7])

      let sum2 = 0

      const summed = collection.each((item) => {
        if (item > 3) {
          return
        }

        sum2 += item
      })

      expect(summed.all()).toEqual([1, 3, 3, 7])
      expect(sum2).toEqual(7)
    })

    it('should stop iterating, when returning false', () => {
      const collection = collect([1, 2, { foo: 'bar' }, { bam: 'baz' }])

      const result = []

      collection.each((item, key) => {
        result[key] = item

        if (typeof item === 'object') {
          return false
        }
      })

      expect(result).toEqual([1, 2, { foo: 'bar' }])
    })

    it('should stop iterating, when returning false with objects', () => {
      const collection = collect({
        player1: 'Darwin Núñez',
        player2: 'Roberto Firmino',
        player3: 'Mohamed Salah',
      })

      const result = {}

      collection.each((item, key) => {
        result[key] = item

        if (item === 'Roberto Firmino') {
          return false
        }
      })

      expect(result).toEqual({
        player1: 'Darwin Núñez',
        player2: 'Roberto Firmino',
      })
    })

    it('should iterate even when the collection is an object', () => {
      let sum3 = 0

      const collection2 = collect({
        a: 1,
        b: 3,
        c: 3,
        d: 7,
      })

      const summed2 = collection2.each((item) => {
        sum3 += item
      })

      expect(summed2.all()).toEqual({
        a: 1,
        b: 3,
        c: 3,
        d: 7,
      })
      expect(sum3).toEqual(14)
    })

    it('should not modify the collection', () => {
      const collection = collect([1, 2, 3, 4])
      const mapped = collection.each(number => number * 2)

      expect(collection.all()).toEqual([1, 2, 3, 4])
      expect(mapped.all()).toEqual(collection.all())
    })

    it('should returns the original collection', () => {
      const collection = collect([1, 2, 3, 4])
      const mapped = collection.each(number => number * 2)

      expect(mapped).toEqual(collection)
    })
  })

  describe('eachSpread() method', () => {
    it('should iterate over the collection', () => {
      const collection = collect([
        [1, 'a'],
        [2, 'b'],
      ])

      const result = []
      collection.eachSpread((number, character) => {
        result.push([number, character])
      })

      expect(result).toEqual(collection.all())
    })

    it('should pass key as the last parameter', () => {
      const collection = collect([
        [1, 'a'],
        [2, 'b'],
      ])

      const results = []
      collection.eachSpread((number, character, key) => {
        results.push([number, character, key])
      })

      expect(results).toEqual([
        [1, 'a', 0],
        [2, 'b', 1],
      ])
    })

    it('should not modify the collection', () => {
      const collection = collect([
        [1, 'a'],
        [2, 'b'],
      ])

      const results = []
      const mapped = collection.eachSpread((number, character, key) => {
        results.push([number, character, key])
      })

      expect(results).toEqual([
        [1, 'a', 0],
        [2, 'b', 1],
      ])
      expect(collection.all()).toEqual([
        [1, 'a'],
        [2, 'b'],
      ])
      expect(mapped.all()).toEqual(collection.all())
    })

    it('should stop looping when returning false', () => {
      const collection = collect([
        [1, 'a'],
        [2, 'b'],
      ])

      const results = []
      const mapped = collection.eachSpread((number, character, key) => {
        if (number === 2) {
          return false
        }

        results.push([number, character, key])

        return true
      })

      expect(results).toEqual([[1, 'a', 0]])
      expect(collection.all()).toEqual([
        [1, 'a'],
        [2, 'b'],
      ])
      expect(mapped.all()).toEqual(collection.all())
    })
  })

  describe('every() method', () => {
    it('should verify that all elements of a collection pass a given truth test', () => {
      const collection = collect([1, 2, 3, 4])

      const shouldBeFalse = collection.every(value => value > 2)
      const shouldBeFalse2 = collection.every(value => value < 2)

      expect(shouldBeFalse).toEqual(false)
      expect(shouldBeFalse2).toEqual(false)

      const shouldBeTrue = collection.every(value => value <= 4)
      expect(shouldBeTrue).toEqual(true)
    })

    it('should also work when collection is an object', () => {
      const collection = collect({
        p1: 'Darwin Núñez',
        p2: 'Roberto Firmino',
      })

      const nameIsNeverSalah = collection.every(name => name !== 'Mohamed Salah')
      expect(nameIsNeverSalah).toEqual(true)

      const alwaysMane = collection.every(name => name === 'Darwin Núñez')
      expect(alwaysMane).toEqual(false)
    })

    it('should also pass the object key to the callback', () => {
      const collection = collect({
        a: 'a',
        b: 'b',
        c: 'c',
      })

      const neverF = collection.every((value, key) => key !== 'f')
      expect(neverF).toEqual(true)
    })
  })

  describe('except() method', () => {
    const post = {
      id: 1,
      title: 'My first post!',
      author: 'ecrmnn',
    }

    it('should return everything except the specified ' + 'properties of an object', () => {
      const collection = collect(post)
      const filtered = collection.except(['title', 'author'])

      expect(filtered.all()).toEqual({
        id: 1,
      })
      expect(collection.all()).toEqual(post)
    })

    it('should return everything except the specified ' + 'items in an array', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const filtered = collection.except([5, 1])

      expect(filtered.all()).toEqual([2, 3, 4])
      expect(collection.all()).toEqual([1, 2, 3, 4, 5])
    })

    it('should take an infinite number of arguments', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const filtered = collection.except(5, 1, 3)

      expect(filtered.all()).toEqual([2, 4])
      expect(collection.all()).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('filter() method', () => {
    it('should filter the collection by a given callback, filtering based on value', () => {
      const collection = collect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      const filtered = collection.filter(item => item > 1)

      expect(filtered.all()).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10])
      expect(collection.all()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    it('should filter the collection by a given callback, filtering based on value', () => {
      const collection = collect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      const filtered = collection.filter((item, key) => key > 3 && key < 7)

      expect(filtered.all()).toEqual([5, 6, 7])
      expect(collection.all()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

      const collection2 = collect({
        key: 'value',
        foo: 'bar',
      })
      const filtered2 = collection2.filter((item, key) => key === 'foo')

      expect(filtered2.all()).toEqual({ foo: 'bar' })
      expect(collection2.all()).toEqual({ key: 'value', foo: 'bar' })
    })

    it('should filter the collection removing "falsely" values if no call back is passed', () => {
      const collection = collect([0, 1, 2, null, 3, 4, undefined, 5, 6, 7, [], 8, 9, {}, [10]])
      const filtered = collection.filter()

      expect(filtered.all()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, [10]])
      expect(collection.all()).toEqual([0, 1, 2, null, 3, 4, undefined, 5, 6, 7, [], 8, 9, {}, [10]])

      const collection2 = collect({
        falseKey: false,
        emptyArray: [],
        baz: 10,
        emptyObject: {},
        foo: 'bar',
        undefinedKey: undefined,
        notEmptyObject: { a: 1 },
        notEmptyArray: [''],
      })
      const filtered2 = collection2.filter()

      expect(filtered2.all()).toEqual({
        baz: 10,
        foo: 'bar',
        notEmptyObject: { a: 1 },
        notEmptyArray: [''],
      })
      expect(collection2.all()).toEqual({
        falseKey: false,
        emptyArray: [],
        baz: 10,
        emptyObject: {},
        foo: 'bar',
        undefinedKey: undefined,
        notEmptyObject: { a: 1 },
        notEmptyArray: [''],
      })
    })
  })

  describe('first() method', () => {
    it('should return the first item from the collection', () => {
      const collection = collect([1, 2, 3, 4])
      const first = collection.first()

      expect(first).toEqual(1)
      expect(collection.all()).toEqual([1, 2, 3, 4])
    })

    it('should also work with an array of objects', () => {
      const collection = collect([{ a: 'a' }, { b: 'b' }])
      const first = collection.first()

      expect(first).toEqual({ a: 'a' })
      expect(collection.all()).toEqual([{ a: 'a' }, { b: 'b' }])
    })

    it('should when the collection is an object', () => {
      const collection = collect({
        name: 'Darwin Núñez',
        club: 'Liverpool FC',
      })

      expect(collection.first()).toEqual('Darwin Núñez')
    })

    it('should accept a callback', () => {
      const collection = collect([1, 2, 3])
      const first = collection.first(item => item > 1)

      expect(first).toEqual(2)
      expect(collection.all()).toEqual([1, 2, 3])
    })

    it('should accept a callback when the collection is an object', () => {
      const collection = collect({
        name: 'Darwin Núñez',
        club: 'Liverpool FC',
      })
      const first = collection.first((item, key) => key === 'club')

      expect(first).toEqual('Liverpool FC')
      expect(collection.all()).toEqual({
        name: 'Darwin Núñez',
        club: 'Liverpool FC',
      })
    })

    it('should accept a default value', () => {
      const collection = collect([4, 3, 2, 1])
      const first = collection.first(item => item >= 5, 5)

      expect(first).toEqual(5)
      expect(collection.all()).toEqual([4, 3, 2, 1])
    })

    it('should accept a callback as the default value', () => {
      const collection = collect([4, 3, 2, 1])
      const first = collection.first(
        item => item >= 6,
        () => 6,
      )

      expect(first).toEqual(6)
      expect(collection.all()).toEqual([4, 3, 2, 1])
    })

    it('should return the default value if there are no items', () => {
      const collectionArray = collect([])
      let firstWithEmpty = collectionArray.first(null, 'Empty')
      let firstWithCallback = collectionArray.first(item => item >= 5, 'EmptyCallback')
      expect(firstWithEmpty).toEqual('Empty')
      expect(firstWithCallback).toEqual('EmptyCallback')
      expect(collectionArray.all()).toEqual([])

      const collectionObject = collect({})
      firstWithEmpty = collectionObject.first(null, 'EmptyObject')
      firstWithCallback = collectionObject.first(item => item >= 5, 'EmptyObjectCallback')
      expect(firstWithEmpty).toEqual('EmptyObject')
      expect(firstWithCallback).toEqual('EmptyObjectCallback')
      expect(collectionObject.all()).toEqual({})
    })
  })

  describe('firstOrFail() method', () => {
    it('should return the first item in collection', () => {
      const collection = collect([{ name: 'foo' }, { name: 'bar' }])

      expect(collection.where('name', 'foo').firstOrFail()).toEqual({ name: 'foo' })
      expect(collection.firstOrFail('name', '=', 'foo')).toEqual({ name: 'foo' })
      expect(collection.firstOrFail('name', 'foo')).toEqual({ name: 'foo' })
    })

    it('should throw error if no items exists', () => {
      const collection = collect([{ name: 'foo' }, { name: 'bar' }])

      expect(() => {
        collection.where('name', 'INVALID').firstOrFail()
      }).toThrow('Item not found.')
    })

    it('should not throw error if more than one item exists', () => {
      const collection = collect([{ name: 'foo' }, { name: 'foo' }, { name: 'bar' }])

      expect(collection.where('name', 'foo').firstOrFail()).toEqual({ name: 'foo' })
    })

    it('should return first item in collection if only one exists with callback', () => {
      const collection = collect(['foo', 'bar', 'baz'])

      const result = collection.firstOrFail(value => value === 'bar')

      expect(result).toEqual('bar')
    })

    it('should throw an exception if no items exist with callback', () => {
      const collection = collect(['foo', 'bar', 'baz'])

      expect(() => {
        collection.firstOrFail(value => value === 'invalid')
      }).toThrow('Item not found.')
    })

    it('should not throw error if more than one item exists with callback', () => {
      const collection = collect(['foo', 'bar', 'baz'])

      const result = collection.firstOrFail(value => value === 'bar')

      expect(result).toEqual('bar')
    })

    it('should stop iterating at first match', () => {
      const collection = collect([
        () => false,
        () => true,
        () => {
          throw new Error('some error message')
        },
      ])

      const result = collection.firstOrFail(callback => callback())

      expect(result).not.toEqual(null)
      expect(result).not.toEqual(false)
    })
  })

  describe('firstWhere() method', () => {
    const products = [
      { product: 'Desk', price: 200, manufacturer: 'IKEA' },
      { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
      { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
      { product: 'Door', price: '100' },
    ]

    it('should return the first item where it matches', () => {
      const collection = collect(products)

      expect(collection.firstWhere('manufacturer', 'IKEA').product).toEqual('Desk')
    })

    it('should return null when no matches', () => {
      const collection = collect(products)

      expect(collection.firstWhere('manufacturer', 'xoxo')).toEqual(null)
    })

    it('should be possible to pass an operator', () => {
      const collection = collect(products)

      expect(collection.firstWhere('manufacturer', '!==', 'IKEA').product).toEqual('Chair')
    })
  })

  describe('flatMap() method', () => {
    it('should flat map', () => {
      const collection = collect([{ tags: ['tag1', 'tag2'] }, { tags: ['tag3', 'tag4'] }])

      const flatMapped = collection.flatMap(item => item.tags)

      expect(flatMapped.all()).toEqual(['tag1', 'tag2', 'tag3', 'tag4'])
    })

    it('should iterate through the collection and passes each value to the given callback', () => {
      const collection = collect([
        {
          name: 'Xherdan Shaqiri',
          number: 23,
        },
        {
          name: 'Mohamed Salah',
          number: 11,
        },
      ])

      const flatMapped = collection.flatMap(value => value.name.toUpperCase())

      expect(flatMapped.all()).toEqual(['XHERDAN SHAQIRI', 'MOHAMED SALAH'])

      expect(collection.all()).toEqual([
        {
          name: 'Xherdan Shaqiri',
          number: 23,
        },
        {
          name: 'Mohamed Salah',
          number: 11,
        },
      ])
    })

    it('should override the value of the key already exists', () => {
      const collection = collect([['Darwin Núñez'], ['Roberto Firmino'], ['Mohamed Salah']])

      const flatMapped = collection.flatMap(values => values[0].toUpperCase())

      expect(flatMapped.all()).toEqual(['DARWIN NÚÑEZ', 'ROBERTO FIRMINO', 'MOHAMED SALAH'])
    })

    it('should receive index as second parameter', () => {
      const collection = collect(['Fabinho', 'Keíta'])

      const flatMapped = collection.flatMap(values => values.toUpperCase())

      expect(flatMapped.all()).toEqual(['FABINHO', 'KEÍTA'])
    })
  })

  describe('flatten() method', () => {
    it('should flatten a multi-dimensional object', () => {
      const data = {
        name: 'Daniel',
        languages: ['JavaScript', 'PHP', 'Go'],
      }

      const collection = collect(data)

      const flatten = collection.flatten()

      expect(flatten.all()).toEqual(['Daniel', 'JavaScript', 'PHP', 'Go'])
    })

    it('should flatten nested arrays and objects', () => {
      const data2 = {
        Apple: [{ name: 'iPhone 6S', brand: 'Apple' }],
        Samsung: [{ name: 'Galaxy S7', brand: 'Samsung' }],
      }

      const collection2 = collect(data2)

      const flattened2 = collection2.flatten(1)

      expect(flattened2.all()).toEqual([
        { name: 'iPhone 6S', brand: 'Apple' },
        { name: 'Galaxy S7', brand: 'Samsung' },
      ])

      const flattened3 = collect(data2).flatten()
      expect(flattened3.all()).toEqual(['iPhone 6S', 'Apple', 'Galaxy S7', 'Samsung'])
    })

    it('should flatten null', () => {
      const data = [null]
      const flattened = collect(data).flatten()
      expect(flattened.all()).toEqual([null])

      const data2 = { name: null }
      const flattened2 = collect(data2).flatten()
      expect(flattened2.all()).toEqual([null])
    })

    it('should flatten undefined', () => {
      const data = [undefined]
      const flattened = collect(data).flatten()
      expect(flattened.all()).toEqual([undefined])

      const data2 = { name: undefined }
      const flattened2 = collect(data2).flatten()
      expect(flattened2.all()).toEqual([undefined])
    })

    it('should not throw errors when encountering null', () => {
      const data = {
        Apple: [{ name: null, brand: 'Apple' }],
        Samsung: [{ name: 'Galaxy S7', brand: 'Samsung' }],
      }

      const flattened = collect(data).flatten()
      expect(flattened.all()).toEqual([null, 'Apple', 'Galaxy S7', 'Samsung'])
    })

    // https://github.com/ecrmnn/collect.js/issues/240
    it('should flatten an object with objects', () => {
      const collection = collect({
        k: { a: [2, 3, 4] },
        b: { a: [5, 6, 7] },
        t: { a: [8, 9, 0] },
      })

      expect(collection.flatten(2).all()).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 0])
    })
  })

  describe('flip() method', () => {
    it('should return a collection with keys and values flipped', () => {
      const collection = collect({
        name: 'Steven Gerrard',
        number: 8,
      })
      const flip = collection.flip()

      expect(flip.all()).toEqual({
        'Steven Gerrard': 'name',
        '8': 'number',
      })

      expect(collection.all()).toEqual({
        name: 'Steven Gerrard',
        number: 8,
      })
    })

    it('should be able to flip an array based collection', () => {
      const collection = collect(['a', 'b', 'c'])
      const flip = collection.flip()

      expect(flip.all()).toEqual({
        a: 0,
        b: 1,
        c: 2,
      })

      expect(collection.all()).toEqual(['a', 'b', 'c'])
    })
  })

  describe('forget() method', () => {
    it('should forget the given key and value', () => {
      const collection = collect({
        name: 'Steven Gerrard',
        number: 8,
      })
      const forget = collection.forget('number')

      expect(forget.all()).toEqual({
        name: 'Steven Gerrard',
      })
      expect(collection.all()).toEqual({
        name: 'Steven Gerrard',
      })
    })

    it('should delete by index, if array based collection', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const forget = collection.forget(2)

      expect(forget.all()).toEqual([1, 2, 4, 5])
      expect(collection.all()).toEqual([1, 2, 4, 5])
    })
  })

  describe('forPage() method', () => {
    it('should return a collection containing the items that would be present on a given page number', () => {
      const collection = collect([1, 2, 3, 4, 5, 6, 7, 8, 9])

      const forPage1 = collection.forPage(1, 3)
      expect(forPage1.all()).toEqual([1, 2, 3])

      const forPage2 = collection.forPage(2, 3)
      expect(forPage2.all()).toEqual([4, 5, 6])

      const forPage3 = collection.forPage(3, 3)
      expect(forPage3.all()).toEqual([7, 8, 9])

      expect(collection.all()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    })

    it('shold work on collections based on an object', () => {
      const collection = collect({
        a: 'AAA',
        b: 'BBB',
        c: 'CCC',
        d: 'DDD',
        e: 'EEE',
      })

      const forPage1 = collection.forPage(1, 3)
      expect(forPage1.all()).toEqual({
        a: 'AAA',
        b: 'BBB',
        c: 'CCC',
      })

      const forPage2 = collection.forPage(2, 3)
      expect(forPage2.all()).toEqual({
        d: 'DDD',
        e: 'EEE',
      })

      const forPage3 = collection.forPage(3, 1)
      expect(forPage3.all()).toEqual({
        c: 'CCC',
      })

      expect(collection.all()).toEqual({
        a: 'AAA',
        b: 'BBB',
        c: 'CCC',
        d: 'DDD',
        e: 'EEE',
      })
    })
  })

  describe('get() method', () => {
    const data = {
      firstname: 'Darwin',
      lastname: 'Núñez',
    }

    const collection = collect(data)

    it('should return the item at a given key', () => {
      expect(collection.get('firstname')).toEqual('Darwin')
      expect(collection.get('name')).toEqual(null)
      expect(collection.all()).toEqual(data)
    })

    it('should accept a default value', () => {
      expect(collection.get('name', 'Daniel')).toEqual('Daniel')
      expect(collection.all()).toEqual(data)
    })

    it('should accept a callback as a default value', () => {
      expect(collection.get('name', () => 'Daniel')).toEqual('Daniel')
      expect(collection.all()).toEqual(data)
    })

    it('should handle having 0 as a default value', () => {
      expect(collection.get('missingKey')).toEqual(null)
      expect(collection.get('missingKey', 0)).toEqual(0)
      expect(collection.all()).toEqual(data)
    })
  })

  describe('groupBy() method', () => {
    const products = [
      { product: 'Catalog', manufacturer: 'IKEA', price: 0 },
      { product: 'Desk', manufacturer: 'IKEA', price: 60 },
      { product: 'Chair', manufacturer: 'IKEA', price: 60 },
      { product: 'Lamp', manufacturer: 'IKEA', price: 15 },
      { product: 'Chair', manufacturer: 'Herman Miller' },
    ]

    it('should group the collections items by the given key', () => {
      const collection = collect(products)
      const grouped = collection.groupBy('manufacturer')

      expect(Object.keys(grouped.all())).toEqual(['IKEA', 'Herman Miller'])
      expect(collection.all()).toEqual(products)
    })

    it('should accept a custom callback to group by', () => {
      const collection = collect(products)
      const grouped = collection.groupBy(item => item.manufacturer.substring(0, 3))

      expect(grouped.all()).toEqual({
        IKE: collect([
          { product: 'Catalog', manufacturer: 'IKEA', price: 0 },
          { product: 'Desk', manufacturer: 'IKEA', price: 60 },
          { product: 'Chair', manufacturer: 'IKEA', price: 60 },
          { product: 'Lamp', manufacturer: 'IKEA', price: 15 },
        ]),
        Her: collect([{ product: 'Chair', manufacturer: 'Herman Miller' }]),
      })

      expect(collection.all()).toEqual(products)
    })

    it('should return a collection of collections when grouped', () => {
      const collection = collect(products)
      const grouped = collection.groupBy('manufacturer')

      expect(grouped.first().all()).toEqual([
        { product: 'Catalog', manufacturer: 'IKEA', price: 0 },
        { product: 'Desk', manufacturer: 'IKEA', price: 60 },
        { product: 'Chair', manufacturer: 'IKEA', price: 60 },
        { product: 'Lamp', manufacturer: 'IKEA', price: 15 },
      ])

      expect(grouped.last().all()).toEqual([{ product: 'Chair', manufacturer: 'Herman Miller' }])

      expect(collection.all()).toEqual(products)
    })

    it('should use an empty string as the key ' + 'if objects are missing the key to group by', () => {
      const collection = collect(products)
      const grouped = collection.groupBy('price')

      expect(grouped.all()).toEqual({
        '0': collect([{ product: 'Catalog', manufacturer: 'IKEA', price: 0 }]),
        '15': collect([{ product: 'Lamp', manufacturer: 'IKEA', price: 15 }]),
        '60': collect([
          { product: 'Desk', manufacturer: 'IKEA', price: 60 },
          { product: 'Chair', manufacturer: 'IKEA', price: 60 },
        ]),
        '': collect([{ product: 'Chair', manufacturer: 'Herman Miller' }]),
      })

      expect(collection.all()).toEqual(products)
    })

    it('should be able to use nested value as key', () => {
      const collection = collect([
        {
          name: 'Virgil van Dijk',
          club: {
            name: 'Liverpool FC',
          },
        },
        {
          name: 'Darwin Núñez',
          club: {
            name: 'Liverpool FC',
          },
        },
      ])

      const grouped = collection.groupBy('club.name')

      expect(grouped.first()).toEqual(collection)
    })
  })

  describe('has() method', () => {
    const unicorn = {
      animal: 'unicorn',
      ability: 'magical',
      description: '',
      amount: 0,
      food: null,
      area: undefined,
      isExist: false,
    }

    it('should determine if a key exists in the collection', () => {
      const collection = collect(unicorn)
      const hasAbility = collection.has('ability')
      const hasName = collection.has('name')

      expect(hasAbility).toEqual(true)
      expect(hasName).toEqual(false)
      expect(collection.all()).toEqual(unicorn)
    })

    it('should accept an array as the argument', () => {
      const collection = collect(unicorn)

      expect(collection.has(['animal', 'ability'])).toEqual(true)
      expect(collection.has(['animal', 'ability', 'name'])).toEqual(false)
      expect(collection.has(['animal', 'name'])).toEqual(false)
      expect(collection.all()).toEqual(unicorn)
    })

    it('should accept an infinite number of arguments', () => {
      const collection = collect(unicorn)

      expect(collection.has('animal', 'ability')).toEqual(true)
      expect(collection.has('animal', 'ability', 'name')).toEqual(false)
      expect(collection.has('animal', 'name')).toEqual(false)
      expect(collection.all()).toEqual(unicorn)
    })

    it('should determine if all objects have the specified key ' + 'when given an array of objects', () => {
      const pig = [
        {
          animal: 'unicorn',
          ability: 'magical',
        },
        {
          name: 'Piggy',
          animal: 'pig',
          ability: 'filthy',
        },
      ]

      const collection = collect(pig)
      const hasAbility = collection.has('ability')
      const hasName = collection.has('name')

      expect(hasAbility).toEqual(false)
      expect(hasName).toEqual(false)
      expect(collection.all()).toEqual(pig)
    })

    it('should determine if a key exists in the collection and has negative value (which equates to "false")', () => {
      const collection = collect(unicorn)
      const hasDescription = collection.has('description')
      const hasAmount = collection.has('amount')
      const hasFood = collection.has('food')
      const hasArea = collection.has('area')
      const hasIsExist = collection.has('isExist')

      expect(hasDescription).toEqual(true)
      expect(hasAmount).toEqual(true)
      expect(hasFood).toEqual(true)
      expect(hasArea).toEqual(true)
      expect(hasIsExist).toEqual(true)
      expect(collection.all()).toEqual(unicorn)
    })
  })

  describe('implode() method', () => {
    it('should glue together the collection', () => {
      const collection = collect([
        { product: 'Desk', price: 200, manufacturer: 'IKEA' },
        { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
        { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
        { product: 'Door', price: '100' },
      ])

      const implodeProduct = collection.implode('product', '-')
      const implodePrice = collection.implode('price', '-')
      const implodeManufacturer = collection.implode('manufacturer', '-')

      expect(implodeProduct).toEqual('Desk-Chair-Bookcase-Door')
      expect(implodePrice).toEqual('200-100-150-100')
      expect(implodeManufacturer).toEqual('IKEA-Herman Miller-IKEA-')
    })

    it('should work with collection based on an array', () => {
      const collection = collect([1, 2, 3])
      const imploded = collection.implode('#')

      expect(imploded).toEqual('1#2#3')
    })

    it('should replace null with a blank value', () => {
      const collection = collect([1, 2, null, 3])
      const imploded = collection.implode('#')

      expect(imploded).toEqual('1#2##3')
    })
  })

  describe('intersect() method', () => {
    it('should return the matching values from collection', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const intersect = collection.intersect([1, 2, 3, 9])

      expect(intersect.all()).toEqual([1, 2, 3])
      expect(collection.all()).toEqual([1, 2, 3, 4, 5])
    })

    it('should accept a collection as an argument', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const intersect = collection.intersect(collect([1, 2, 3, 9]))

      expect(intersect.all()).toEqual([1, 2, 3])
      expect(collection.all()).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('intersectByKeys() method', () => {
    it('should remove any keys from the original collection that '
      + 'are not present in the given array or collection', () => {
      const collection = collect({
        name: 'Darwin Núñez',
        number: 27,
      })

      const collection2 = collect({
        name: 'Luis Suarez',
        number: 9,
        club: 'FC Barcelona',
      })

      expect(
        collection
          .intersectByKeys({
            name: 'Steven Gerrard',
          })
          .all(),
      ).toEqual({
        name: 'Darwin Núñez',
      })

      expect(collection.intersectByKeys(collection2).all()).toEqual({
        name: 'Darwin Núñez',
        number: 27,
      })
    })
  })

  describe('isEmpty() method', () => {
    it('should return true if collection is empty', () => {
      expect(collect().isEmpty()).toEqual(true)

      expect(collect(null).isEmpty()).toEqual(true)
      expect(collect(undefined).isEmpty()).toEqual(true)

      expect(collect([]).isEmpty()).toEqual(true)
      expect(collect({}).isEmpty()).toEqual(true)

      expect(collect(['']).isEmpty()).toEqual(false)
      expect(collect([1, 2, 3]).isEmpty()).toEqual(false)

      expect(collect([null]).isEmpty()).toEqual(false)
      expect(collect([undefined]).isEmpty()).toEqual(false)
    })

    it('should return false if collection is not empty', () => {
      expect(collect('value').isEmpty()).toEqual(false)
      expect(collect(['value']).isEmpty()).toEqual(false)
      expect(collect({ key: 'value' }).isEmpty()).toEqual(false)
    })

    it('should also work if the collection is an empty string', () => {
      expect(collect('').isEmpty()).toEqual(false)
      expect(collect('xo').isEmpty()).toEqual(false)
    })
  })

  describe('isNotEmpty() method', () => {
    it('should return true if the collection is not empty; otherwise, false is returned', () => {
      expect(collect().isNotEmpty()).toEqual(false)
      expect(collect([]).isNotEmpty()).toEqual(false)
      expect(collect([1]).isNotEmpty()).toEqual(true)
    })

    it('should return false if collection is empty', () => {
      expect(collect().isNotEmpty()).toEqual(false)
      expect(collect([]).isNotEmpty()).toEqual(false)
      expect(collect({}).isNotEmpty()).toEqual(false)
      expect(collect(['']).isNotEmpty()).toEqual(true)
      expect(collect([1, 2, 3]).isNotEmpty()).toEqual(true)
    })

    it('should return true if collection is not empty', () => {
      expect(collect('value').isNotEmpty()).toEqual(true)
      expect(collect(['value']).isNotEmpty()).toEqual(true)
      expect(collect({ key: 'value' }).isNotEmpty()).toEqual(true)
    })

    it('should also work if the collection is an empty string', () => {
      expect(collect('').isNotEmpty()).toEqual(true)
      expect(collect('xo').isNotEmpty()).toEqual(true)
    })
  })

  describe('join() method', () => {
    it('should join the collection', () => {
      expect(collect(['a', 'b', 'c']).join(', ')).toEqual('a, b, c')

      expect(collect(['a', 'b', 'c']).join(', ', ' and ')).toEqual('a, b and c')

      expect(collect(['a', 'b']).join(', ', ' and ')).toEqual('a and b')

      expect(collect(['a']).join(', ', ' and ')).toEqual('a')

      expect(collect([]).join(', ', ' and ')).toEqual('')
    })

    it('should join the object based collection', () => {
      expect(
        collect({
          first: 'a',
          second: 'b',
          third: 'c',
        }).join(', '),
      ).toEqual('a, b, c')

      expect(
        collect({
          first: 'a',
          second: 'b',
          third: 'c',
        }).join(', ', ' and '),
      ).toEqual('a, b and c')

      expect(
        collect({
          first: 'a',
          second: 'b',
        }).join(', ', ' and '),
      ).toEqual('a and b')

      expect(
        collect({
          first: 'a',
        }).join(', ', ' and '),
      ).toEqual('a')

      expect(collect({}).join(', ', ' and ')).toEqual('')
    })
  })

  describe('keyBy() method', () => {
    const data = [
      {
        id: 100,
        product: 'Chair',
        manufacturer: 'IKEA',
        price: '1490 NOK',
      },
      {
        id: 150,
        product: 'Desk',
        manufacturer: 'IKEA',
        price: '900 NOK',
      },
      {
        id: 200,
        product: 'Chair',
        manufacturer: 'Herman Miller',
        price: '9990 NOK',
      },
    ]

    it('should key the collection by the given key', () => {
      const collection = collect(data)
      const keyed = collection.keyBy('manufacturer')

      expect(keyed.all()).toEqual({
        'IKEA': {
          id: 150,
          product: 'Desk',
          manufacturer: 'IKEA',
          price: '900 NOK',
        },
        'Herman Miller': {
          id: 200,
          product: 'Chair',
          manufacturer: 'Herman Miller',
          price: '9990 NOK',
        },
      })

      expect(collection.all()).toEqual(data)
    })

    it('should key the collection by the given callback', () => {
      const collection = collect(data)
      const keyedUpperCase = collection.keyBy(item => item.manufacturer.toUpperCase())

      expect(keyedUpperCase.all()).toEqual({
        'IKEA': {
          id: 150,
          product: 'Desk',
          manufacturer: 'IKEA',
          price: '900 NOK',
        },
        'HERMAN MILLER': {
          id: 200,
          product: 'Chair',
          manufacturer: 'Herman Miller',
          price: '9990 NOK',
        },
      })

      expect(collection.all()).toEqual(data)
    })

    it('should only keep one items per key', () => {
      const collection = collect([
        {
          name: 'Darwin Núñez',
          club: 'Liverpool FC',
        },
        {
          name: 'Roberto Firmino',
          club: 'Liverpool FC',
        },
        {
          name: 'Mohamed Salah',
          club: 'Liverpool FC',
        },
      ])

      const keyed = collection.keyBy('club')

      expect(keyed.all()).toEqual({
        'Liverpool FC': {
          name: 'Mohamed Salah',
          club: 'Liverpool FC',
        },
      })
    })

    it('should key everything by an empty string if key does not exist', () => {
      const collection = collect(data)
      const keyed = collection.keyBy('xoxo')

      expect(keyed.all()).toEqual({
        '': {
          id: 200,
          product: 'Chair',
          manufacturer: 'Herman Miller',
          price: '9990 NOK',
        },
      })

      expect(collection.all()).toEqual(data)
    })

    it('should be able to use nested value as key', () => {
      const collection = collect([
        {
          name: 'Virgil van Dijk',
          club: {
            name: 'Liverpool FC',
          },
        },
        {
          name: 'Darwin Núñez',
          club: {
            name: 'Liverpool FC',
          },
        },
      ])

      const keyed = collection.keyBy('club.name')

      expect(keyed.first()).toEqual({
        name: 'Darwin Núñez',
        club: {
          name: 'Liverpool FC',
        },
      })
    })
  })

  describe('keys() method', () => {
    it('should return the collection keys', () => {
      const player = {
        name: 'Darwin Núñez',
        number: 27,
        club: 'Liverpool FC',
      }

      const collection = collect(player)
      const keys = collection.keys()

      expect(keys.all()).toEqual(['name', 'number', 'club'])
      expect(collection.all()).toEqual(player)
    })

    it('should work when the collection is an array', () => {
      const collection = collect(['a', 'b', 'c'])
      const keys = collection.keys()

      expect(keys.all()).toEqual([0, 1, 2])
      expect(collection.all()).toEqual(['a', 'b', 'c'])
    })

    it('should return indexes as keys when array with objects', () => {
      const players = [
        {
          name: 'Darwin Núñez',
        },
        {
          name: 'Roberto Firmino',
        },
      ]

      const collection = collect(players)
      const keys = collection.keys()

      expect(keys.all()).toEqual([0, 1])
      expect(collection.all()).toEqual(players)
    })
  })

  describe('last() method', () => {
    it('should return the last item from the collection', () => {
      const collection = collect([1, 2, 3, 4])
      const last = collection.last()
      expect(last).toEqual(4)
      expect(collection.all()).toEqual([1, 2, 3, 4])
    })

    it('should work with array of objects', () => {
      const collection = collect([{ a: 'a' }, { b: 'b' }])
      const last = collection.last()
      expect(last).toEqual({ b: 'b' })
      expect(collection.all()).toEqual([{ a: 'a' }, { b: 'b' }])
    })

    it('should when the collection is an object', () => {
      const collection = collect({
        name: 'Darwin Núñez',
        club: 'Liverpool FC',
      })

      expect(collection.last()).toEqual('Liverpool FC')
    })

    it('should when the collection is an object with a custom callback', () => {
      const collection = collect({
        name: 'Darwin Núñez',
        club: 'Liverpool FC',
      })

      expect(collection.last(item => item === 'Liverpool FC')).toEqual('Liverpool FC')
    })

    it('should accept custom callback', () => {
      const collection = collect([1, 2, 3])
      const last = collection.last(item => item > 1)
      expect(last).toEqual(3)
      expect(collection.all()).toEqual([1, 2, 3])
    })

    it('should accept a default value', () => {
      const collection = collect([4, 3, 2, 1])
      const lastA = collection.last(
        item => item >= 6,
        () => 5,
      )

      expect(lastA).toEqual(5)
      expect(collection.all()).toEqual([4, 3, 2, 1])
    })

    it('should accept a callback as the default value', () => {
      const collection = collect([4, 3, 2, 1])
      const lastA = collection.last(
        item => item >= 6,
        () => 6,
      )

      expect(lastA).toEqual(6)
      expect(collection.all()).toEqual([4, 3, 2, 1])
    })
  })

  describe('macro() method', () => {
    it('should be able to register a custom macro/method', () => {
      collect().macro('uppercase', function uppercase() {
        return this.map(item => item.toUpperCase())
      })

      const collection = collect(['a', 'b', 'c'])
      expect(collection.uppercase().all()).toEqual(['A', 'B', 'C'])
      expect(collection.all()).toEqual(['a', 'b', 'c'])

      collect().macro('prefix', function pfx(prefix) {
        return this.map(item => prefix + item)
      })

      expect(collect(['a', 'b', 'c']).prefix('xoxo').all()).toEqual(['xoxoa', 'xoxob', 'xoxoc'])
    })
  })

  describe('make() method', () => {
    it('should make a new collection', () => {
      const collection = collect().make('foo')
      expect(collection.all()).toEqual(['foo'])
    })

    it('should make a new collection from null', () => {
      const collection = collect().make(null)
      expect(collection.all()).toEqual([])
    })

    it('should make a new collection from nothing', () => {
      const collection = collect().make()
      expect(collection.all()).toEqual([])
    })

    it('should make a new collection from an array', () => {
      const collection = collect().make([1, 2, 3])
      expect(collection.all()).toEqual([1, 2, 3])
    })

    it('should make a new collection from an object', () => {
      const collection = collect().make({ foo: 'bar' })
      expect(collection.all()).toEqual({ foo: 'bar' })
    })

    it('should make a new collection from other collection', () => {
      const firstCollection = collect().make({ foo: 'bar' })
      const secondCollection = collect().make(firstCollection)

      expect(secondCollection.all()).toEqual({ foo: 'bar' })
    })
  })

  describe('map() method', () => {
    it('should map over and modify the collection', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const multiplied = collection.map(item => item * 2)

      expect(multiplied.all()).toEqual([2, 4, 6, 8, 10])
      expect(collection.all()).toEqual([1, 2, 3, 4, 5])

      const collection2 = collect([1, 2, 3, 4, 5])
      const multiplied2 = collection2.map((item, key) => key * 2)

      expect(multiplied2.all()).toEqual([0, 2, 4, 6, 8])
      expect(collection2.all()).toEqual([1, 2, 3, 4, 5])
    })

    it('should map over an object and modify the values', () => {
      const collection = collect({
        foo: 1,
        bar: 2,
        baz: 3,
      })

      const multiplied = collection.map(item => item * 2)

      expect(multiplied.all()).toEqual({
        foo: 2,
        bar: 4,
        baz: 6,
      })

      expect(collection.all()).toEqual({
        foo: 1,
        bar: 2,
        baz: 3,
      })
    })
  })

  describe('mapInto() method', () => {
    it('should map into a class', () => {
      const Person = function p(name) {
        this.name = name
      }

      const collection = collect(['Firmino', 'Núñez'])

      const data = collection.mapInto(Person)

      expect(data.all()).toBeInstanceOf(Array)
      expect(data.first()).toEqual(new Person('Firmino'))
      expect(data.last()).toEqual(new Person('Núñez'))
    })
  })

  describe('mapSpread() method', () => {
    it('should iterate over the collection', () => {
      const collection = collect([
        [1, 'a'],
        [2, 'b'],
      ])

      const result = []
      collection.mapSpread((number, character) => {
        result.push([number, character])
      })

      expect(result).toEqual(collection.all())
    })

    it('should pass key as the last parameter', () => {
      const collection = collect([
        [1, 'a'],
        [2, 'b'],
      ])

      const results = []
      collection.mapSpread((number, character, key) => {
        results.push([number, character, key])
      })

      expect(results).toEqual([
        [1, 'a', 0],
        [2, 'b', 1],
      ])
    })

    it('should modify the collection', () => {
      const collection = collect([
        [1, 'a'],
        [2, 'b'],
      ])

      const results = []
      const mapped = collection.mapSpread((number, character, key) => {
        results.push([number, character, key])
      })

      expect(results).toEqual([
        [1, 'a', 0],
        [2, 'b', 1],
      ])
      expect(mapped.all()).not.toEqual(collection.all())
    })
  })

  describe('mapToDictionary() method', () => {
    it('should map into a dictionary', () => {
      const collection = collect([
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 3, name: 'c' },
        { id: 4, name: 'b' },
      ])

      const groups = collection.mapToDictionary(item => [item.name, item.id])

      expect(groups.all()).toEqual({
        a: [1],
        b: [2, 4],
        c: [3],
      })
    })

    it('should work plain array', () => {
      const collection = collect([1, 2, 3, 2, 1])

      const groups = collection.mapToDictionary((item, key) => [item, key])

      expect(groups.all()).toEqual({
        1: [0, 4],
        2: [1, 3],
        3: [2],
      })
    })
  })

  describe('mapToGroups() method', () => {
    it('should map a collection to groups', () => {
      const data = collect([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
        { id: 4, name: 'B' },
      ])

      const groups = data.mapToGroups(item => [item.name, item.id])

      expect(groups.all()).toEqual({
        A: [1],
        B: [2, 4],
        C: [3],
      })
    })
  })

  describe('mapWithKeys() method', () => {
    it('should return an object containing a single key / value pair:', () => {
      const employees = [
        {
          name: 'John',
          department: 'Sales',
          email: 'john@example.com',
        },
        {
          name: 'Jane',
          department: 'Marketing',
          email: 'jane@example.com',
        },
      ]

      const collection = collect(employees)

      const keyed = collection.mapWithKeys(item => [item.email, item.name])

      expect(keyed.all()).toEqual({
        'john@example.com': 'John',
        'jane@example.com': 'Jane',
      })

      expect(collection.all()).toEqual(employees)
    })

    it('should also work with nested objects', () => {
      const players = {
        player1: {
          name: 'John',
          department: 'Sales',
          email: 'john@example.com',
        },
        player2: {
          name: 'Jane',
          department: 'Marketing',
          email: 'jane@example.com',
        },
      }

      const nestedObject = collect(players)

      const keyed = nestedObject.mapWithKeys(item => [item.email, item.name])

      expect(keyed.all()).toEqual({
        'john@example.com': 'John',
        'jane@example.com': 'Jane',
      })

      expect(nestedObject.all()).toEqual({
        player1: {
          name: 'John',
          department: 'Sales',
          email: 'john@example.com',
        },
        player2: {
          name: 'Jane',
          department: 'Marketing',
          email: 'jane@example.com',
        },
      })
    })
  })

  describe('max() method', () => {
    it('should return the maximum value of a given key', () => {
      const collection = collect([
        {
          value: 10,
        },
        {
          value: -13,
        },
        {
          value: 12,
        },
        {
          value: undefined,
        },
        {
          unicorn: false,
        },
      ])

      const max = collection.max('value')

      expect(max).toEqual(12)

      expect(collection.all()).toEqual([
        {
          value: 10,
        },
        {
          value: -13,
        },
        {
          value: 12,
        },
        {
          value: undefined,
        },
        {
          unicorn: false,
        },
      ])
    })

    it('should return the maximum value in the collection', () => {
      const collection = collect([-1, -2345, 12, 11, 3])
      const max = collection.max()

      expect(max).toEqual(12)

      expect(collection.all()).toEqual([-1, -2345, 12, 11, 3])
    })
  })

  describe('median() method', () => {
    it('should return the median value of collection values', () => {
      const collection = collect([10, 10, 20, 40])

      expect(collection.median()).toEqual(15)
      expect(collection.all()).toEqual([10, 10, 20, 40])

      expect(collect([1, 3, 3, 6, 7, 8, 9]).median()).toEqual(6)
    })

    it('should return the median value of collection values by key', () => {
      const collectionOfObjects = collect([{ foo: 1 }, { foo: 1 }, { foo: 2 }, { foo: 4 }])

      expect(collectionOfObjects.median('foo')).toEqual(1.5)

      const collectionOfObjects2 = collect([
        { foo: 1 },
        { foo: 3 },
        { foo: 3 },
        { foo: 6 },
        { foo: 7 },
        { foo: 8 },
        { foo: 9 },
      ])

      expect(collectionOfObjects2.median('foo')).toEqual(6)
    })
  })

  describe('mergeRecursive()', () => {
    it('should return the merged collection', () => {
      const collection = collect({
        name: 'Steven Gerrard',
        number: 8,
      })
      const merge = collection.merge({
        spouse: 'Alex Curran',
      })

      expect(merge.all()).toEqual({
        name: 'Steven Gerrard',
        number: 8,
        spouse: 'Alex Curran',
      })
      expect(collection.all()).toEqual({
        name: 'Steven Gerrard',
        number: 8,
      })
    })

    it('should concat when merging two arrays', () => {
      const collection = collect(['Unicorn', 'Rainbow'])
      const merged = collection.merge(['Sunshine', 'Rainbow'])

      expect(merged.all()).toEqual(['Unicorn', 'Rainbow', 'Sunshine', 'Rainbow'])
      expect(collection.all()).toEqual(['Unicorn', 'Rainbow'])
    })

    it('should overwrite the value if the key is already defined', () => {
      const collection = collect({ name: 'Steven Gerrard' })
      const merge = collection.merge({ name: 'Alex Curran' })

      expect(merge.all()).toEqual({ name: 'Alex Curran' })
      expect(collection.all()).toEqual({ name: 'Steven Gerrard' })
    })

    it('should be able to merge with an array', () => {
      const collection = collect({ name: 'Steven Gerrard' })
      const merge = collection.merge([1, 2, 3])

      expect(merge.all()).toEqual({
        0: 1,
        1: 2,
        2: 3,
        name: 'Steven Gerrard',
      })
      expect(collection.all()).toEqual({ name: 'Steven Gerrard' })
    })

    it('should be able to merge with a string', () => {
      const collection = collect({ name: 'Steven Gerrard' })
      const merge = collection.merge('xoxo')

      expect(merge.all()).toEqual({
        0: 'xoxo',
        name: 'Steven Gerrard',
      })
      expect(collection.all()).toEqual({ name: 'Steven Gerrard' })
    })
  })

  describe('mergeRecursive() method', () => {
    it('can merge two objects', () => {
      const data = {
        name: 'Bob',
        id: 1,
      }

      const collection = collect(data)

      const merged = collection.mergeRecursive({
        name: 'Bob',
        id: 2,
      })

      expect(merged.all()).toEqual({
        name: 'Bob',
        id: [1, 2],
      })

      expect(collection.all()).toEqual(data)
    })

    it('can merge recursively', () => {
      const data = {
        name: 'Bob',
        id: 1,
        meta: {
          tags: ['a', 'b'],
          roles: 'admin',
        },
      }

      const collection = collect(data)

      const merged = collection.mergeRecursive({
        meta: {
          tags: ['c'],
          roles: 'editor',
        },
      })

      expect(merged.all()).toEqual({
        name: 'Bob',
        id: 1,
        meta: {
          tags: ['a', 'b', 'c'],
          roles: ['admin', 'editor'],
        },
      })

      expect(collection.all()).toEqual(data)
    })

    it('can merge with another collection', () => {
      const data = {
        name: 'Bob',
        id: 1,
        meta: {
          tags: ['a', 'b'],
          roles: 'admin',
        },
      }

      const collection = collect(data)

      const merged = collection.mergeRecursive(
        collect({
          meta: {
            tags: ['c'],
            roles: 'editor',
          },
        }),
      )

      expect(merged.all()).toEqual({
        name: 'Bob',
        id: 1,
        meta: {
          tags: ['a', 'b', 'c'],
          roles: ['admin', 'editor'],
        },
      })

      expect(collection.all()).toEqual(data)
    })

    it('can merge an array with an object', () => {
      const collection = collect([1, 2, 3])

      const merged = collection.mergeRecursive({
        name: 'Bob',
        id: 1,
      })

      expect(merged.all()).toEqual({
        0: 1,
        1: 2,
        2: 3,
        name: 'Bob',
        id: 1,
      })
    })

    it('can merge an object with an array', () => {
      const collection = collect({
        name: 'Bob',
        id: 1,
      })

      const merged = collection.mergeRecursive([1, 2, 3])

      expect(merged.all()).toEqual({
        0: 1,
        1: 2,
        2: 3,
        name: 'Bob',
        id: 1,
      })
    })

    it('should not be modified when merging with null', () => {
      const collection = collect({
        name: 'Bob',
        id: 1,
      })

      const merged = collection.mergeRecursive(null)

      expect(merged.all()).toEqual({
        name: 'Bob',
        id: 1,
      })
    })
  })

  describe('min() method', () => {
    it('should return the minimum value in the collection', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const min = collection.min()

      expect(collection.all()).toEqual([1, 2, 3, 4, 5])
      expect(min).toEqual(1)
    })

    it('should work with negative values', () => {
      const collection = collect([1, 2, 3, 4, 5, -5, -4, -3, -2 - 1])
      const min = collection.min()

      expect(collection.all()).toEqual([1, 2, 3, 4, 5, -5, -4, -3, -2 - 1])
      expect(min).toEqual(-5)
    })

    it('should return the minimum value of a given key', () => {
      const data = [
        {
          worth: 100,
        },
        {
          worth: 900,
        },
        {
          worth: 79,
        },
        {
          worth: undefined,
        },
        {
          unicorn: false,
        },
      ]

      const collection = collect(data)
      const minKey = collection.min('worth')
      expect(minKey).toEqual(79)
      expect(collection.all()).toEqual(data)
    })
  })

  describe('mode() method', () => {
    it('should return the mode value of collection values', () => {
      const collection = collect([10, 10, 20, 40])
      expect(collection.mode()).toEqual([10])
      expect(collection.all()).toEqual([10, 10, 20, 40])

      expect(collect([1, 3, 3, 6, 7, 8, 9]).mode()).toEqual([3])
    })

    it('should return null when getting the mode of an empty collection', () => {
      expect(collect().mode()).toEqual(null)
      expect(collect(null).mode()).toEqual(null)
      expect(collect([]).mode()).toEqual(null)
    })

    it('should not recognize an empty string as an empty collection', () => {
      expect(collect('').mode()).toEqual([''])
    })

    it('should return the mode value of collection values by key', () => {
      const collectionOfObjects = collect([{ foo: 1 }, { foo: 1 }, { foo: 2 }, { foo: 4 }])

      expect(collectionOfObjects.mode('foo')).toEqual([1])

      const collectionOfObjects2 = collect([
        { foo: 1 },
        { foo: 3 },
        { foo: 3 },
        { foo: 6 },
        { foo: 7 },
        { foo: 8 },
        { foo: 9 },
      ])

      expect(collectionOfObjects2.mode('foo')).toEqual([3])
    })

    it('should return array with multiple values if necessary', () => {
      expect(collect([1, 2, 3]).mode()).toEqual([1, 2, 3])
      expect(collect([1, 1, 2, 4, 4]).mode()).toEqual([1, 4])

      const collectionOfObjects3 = collect([{ foo: 1 }, { foo: 3 }, { foo: 3 }, { foo: 6 }, { foo: 6 }])

      expect(collectionOfObjects3.mode('foo')).toEqual([3, 6])

      expect(collect([1, 1, 2, 4, 4]).mode()).toEqual([1, 4])
    })
  })

  describe('nth() method', () => {
    const collection = collect(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])

    it('should create a new collection consisting of every n-th element', () => {
      const nth4 = collection.nth(4)
      expect(nth4.all()).toEqual(['a', 'e', 'i'])
    })

    it('should return all items when receiving 1 as the first argument', () => {
      const nth1 = collection.nth(1)
      expect(nth1.all()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])
    })

    it('should accept offset as the second argument', () => {
      const nth4offset1 = collection.nth(4, 1)
      expect(nth4offset1.all()).toEqual(['b', 'f'])

      const nth4offset3 = collection.nth(4, 3)
      expect(nth4offset3.all()).toEqual(['d', 'h'])
    })

    it('should work when the collection is based on an object', () => {
      const collection2 = collect({
        a: 'b',
        c: 'd',
        e: 'f',
      })

      const nth = collection2.nth(1)
      expect(nth.all()).toEqual(['b', 'd', 'f'])
    })
  })

  describe('only() method', () => {
    const post = {
      id: 1,
      title: 'My first post!',
      author: 'chrisbreuer',
    }

    it('should only return the specified properties of an object', () => {
      const collection = collect(post)
      const filtered = collection.only(['title', 'author'])

      expect(collection.all()).toEqual(post)
      expect(filtered.all()).toEqual({
        title: 'My first post!',
        author: 'chrisbreuer',
      })
    })

    it('should only return the specified items in an array', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const filtered = collection.only([5, 1])

      expect(collection.all()).toEqual([1, 2, 3, 4, 5])
      expect(filtered.all()).toEqual([1, 5])

      const collection2 = collect([1, 2, 3, 4, 5])
      const filtered2 = collection2.only([2, 3, 12])

      expect(collection2.all()).toEqual([1, 2, 3, 4, 5])
      expect(filtered2.all()).toEqual([2, 3])
    })

    it('should take an infinite number of arguments', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const filtered = collection.only(5, 1, 3)

      expect(collection.all()).toEqual([1, 2, 3, 4, 5])
      expect(filtered.all()).toEqual([1, 3, 5])
    })
  })

  describe('pad() method', () => {
    it('should pad the collection to the specified length with a value', () => {
      const collection = collect({
        a: 'aaa',
        b: 'bbb',
        c: 'ccc',
      })

      const filtered = collection.pad(5, 9)

      expect(filtered.all()).toEqual({
        a: 'aaa',
        b: 'bbb',
        c: 'ccc',
        0: 9,
        1: 9,
      })
    })

    it('should stay the same if the size is equal to the length of the collection', () => {
      const collection = collect({
        a: 'aaa',
        b: 'bbb',
        c: 'ccc',
      })

      const filtered = collection.pad(3, 999999)

      expect(filtered.all()).toEqual({
        a: 'aaa',
        b: 'bbb',
        c: 'ccc',
      })
    })

    it('should not override numeric keys', () => {
      const collection = collect({
        a: 'aaa',
        b: 'bbb',
        c: 'ccc',
        0: 'ddd',
        2: 'eee',
      })

      const filtered = collection.pad(7, 'xoxo')

      expect(filtered.all()).toEqual({
        a: 'aaa',
        b: 'bbb',
        c: 'ccc',
        0: 'ddd',
        1: 'xoxo',
        2: 'eee',
        3: 'xoxo',
      })
    })

    it('should not modify collection', () => {
      const collection = collect({
        a: 'aaa',
        b: 'bbb',
        c: 'ccc',
        0: 'ddd',
        2: 'eee',
      })

      const filtered = collection.pad(6, 'xoxo')

      expect(filtered.all()).toEqual({
        a: 'aaa',
        b: 'bbb',
        c: 'ccc',
        0: 'ddd',
        1: 'xoxo',
        2: 'eee',
      })

      expect(collection.all()).toEqual({
        a: 'aaa',
        b: 'bbb',
        c: 'ccc',
        0: 'ddd',
        2: 'eee',
      })
    })

    it('should pad when based on plain array', () => {
      const collection = collect([1, 2, 3])
      const filtered = collection.pad(6, 'xoxo')

      expect(filtered.all()).toEqual([1, 2, 3, 'xoxo', 'xoxo', 'xoxo'])
      expect(collection.all()).toEqual([1, 2, 3])
    })

    it('should prepend when passing a negative size', () => {
      const collection = collect([1, 2, 3])
      const filtered = collection.pad(-5, 5)

      expect(filtered.all()).toEqual([5, 5, 1, 2, 3])
      expect(collection.all()).toEqual([1, 2, 3])
    })
  })

  describe('partition() method', () => {
    it('should separate elements that pass a given truth test from those that do not', () => {
      const collection = collect([1, 2, 3, 4, 5, 6])

      const arr = collection.partition(i => i < 3)

      expect(arr.all()).toEqual([collect([1, 2]), collect([3, 4, 5, 6])])
      expect(arr.first().all()).toEqual([1, 2])
      expect(collection.all()).toEqual([1, 2, 3, 4, 5, 6])
    })

    it('should also work when collection is based on an object', () => {
      const collection = collect({
        name: 'Darwin Núñez',
        number: 27,
        club: 'Liverpool FC',
      })

      const arr = collection.partition(v => typeof v === 'string')

      expect(arr.all()).toEqual([
        collect({
          name: 'Darwin Núñez',
          club: 'Liverpool FC',
        }),
        collect({
          number: 27,
        }),
      ])
    })
  })

  describe('pipe() method', () => {
    it('should pass the collection to the given callback and return the result', () => {
      const collection = collect([1, 2, 3])

      const piped = collection.pipe(c => c.sum())

      expect(piped).toEqual(6)
    })

    it('should not modify the original collection', () => {
      const collection = collect(['name', 'number', 'club'])

      const piped = collection.pipe(player => player.combine(['Roberto Firmino', 9, 'Liverpool FC']))

      expect(piped.all()).toEqual({
        name: 'Roberto Firmino',
        number: 9,
        club: 'Liverpool FC',
      })

      expect(collection.all()).toEqual(['name', 'number', 'club'])
    })
  })

  describe('pluck() method', () => {
    const products = [
      { product: 'Desk', price: 200, manufacturer: 'IKEA' },
      { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
      { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
      { product: 'Door', price: '100' },
    ]
    const collection = collect(products)

    it('should retrieve all of the collection values for a given key', () => {
      const pluck = collection.pluck('product')

      expect(pluck.all()).toEqual(['Desk', 'Chair', 'Bookcase', 'Door'])
      expect(collection.all()).toEqual(products)
    })

    it('should return null when an object is missing the key', () => {
      const pluck = collection.pluck('manufacturer')

      expect(pluck.all()).toEqual(['IKEA', 'Herman Miller', 'IKEA', null])
      expect(collection.all()).toEqual(products)

      const nulls = collection.pluck('non existing key')
      expect(nulls.all()).toEqual([null, null, null, null])
      expect(collection.all()).toEqual(products)
    })

    it('should be able to pluck key and value pairs', () => {
      const pluck = collection.pluck('price', 'product')

      expect(pluck.all()).toEqual({
        Desk: 200,
        Chair: 100,
        Bookcase: 150,
        Door: '100',
      })
    })

    it('should return an array when only plucking values', () => {
      const pluck = collection.pluck('product')

      expect(Array.isArray(pluck.all())).toBe(true)
      expect(typeof pluck.all()).not.toBe('object')
    })

    it('should return an object when plucking key and value pairs', () => {
      const pluck = collection.pluck('price', 'product')

      expect(pluck.all()).toBeInstanceOf(Object)
      expect(Array.isArray(pluck.all())).toBe(false)
    })

    it('should overwrite existing keys', () => {
      const pluck = collection.pluck('product', 'manufacturer')

      expect(pluck.all()).toEqual({
        'IKEA': 'Bookcase',
        'Herman Miller': 'Chair',
        '': 'Door',
      })
    })

    it('should use empty string as key if object is missing property', () => {
      const pluck = collection.pluck('product', 'manufacturer')

      expect(pluck.keys().last()).toEqual('')
      expect(pluck.last()).toEqual('Door')
    })

    it('should use null as value if value is missing', () => {
      const pluck = collection.pluck('manufacturer', 'product')

      expect(pluck.get('Door')).toEqual(null)

      expect(pluck.all()).toEqual({
        Desk: 'IKEA',
        Chair: 'Herman Miller',
        Bookcase: 'IKEA',
        Door: null,
      })
    })

    it('should not return null instead of 0', () => {
      const data = [
        { name: 'January', count: 0 },
        { name: 'February', count: 0 },
        { name: 'March', count: 1 },
        { name: 'April', count: 0 },
        { name: 'May', count: 2 },
        { name: 'June', count: 0 },
        { name: 'July', count: 0 },
        { name: 'August', count: 0 },
        { name: 'September', count: 0 },
        { name: 'October', count: 0 },
        { name: 'November', count: 0 },
        { name: 'December', count: 0 },
      ]

      expect(collect(data).pluck('count').all()).toEqual([0, 0, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0])

      expect(collect(data).pluck('count', 'name').first()).toEqual(0)
    })

    it('should allow dot notation', () => {
      const users = collect([
        {
          name: 'John',
          roles: [
            {
              name: 'Editor',
            },
            {
              name: 'Admin',
            },
          ],
        },
      ])

      expect(users.pluck('roles.0.name')).toEqual(collect(['Editor']))
      expect(users.pluck('roles.1.name')).toEqual(collect(['Admin']))
    })

    it('should allow wildcard dot notation', () => {
      const users = collect([
        {
          name: 'John',
          roles: [
            {
              name: 'Editor',
            },
            {
              name: 'Admin',
            },
          ],
        },
      ])

      expect(users.pluck('*').all()).toEqual([
        [
          'John',
          [
            {
              name: 'Editor',
            },
            {
              name: 'Admin',
            },
          ],
        ],
      ])

      expect(users.pluck('roles.*.name').all()).toEqual([['Editor', 'Admin']])
    })

    it('should allow null as value in wildcard', () => {
      const users = collect([
        {
          name: 'John',
          roles: [
            {
              name: 'Editor',
            },
            {
              name: null,
            },
          ],
        },
      ])

      expect(users.pluck('roles.*.name').all()).toEqual([['Editor', null]])
    })

    it('should allow undefined as value in wildcard', () => {
      const users = collect([
        {
          name: 'John',
          roles: [
            {
              name: 'Editor',
            },
            {
              name: undefined,
            },
          ],
        },
      ])

      expect(users.pluck('roles.*.name').all()).toEqual([['Editor', undefined]])
    })

    it('should allow symbol as value in wildcard', () => {
      const symbol = Symbol('Foo')

      const users = collect([
        {
          name: 'John',
          roles: [
            {
              name: 'Editor',
            },
            {
              name: symbol,
            },
          ],
        },
      ])

      expect(users.pluck('roles.*.name').all()).toEqual([['Editor', symbol]])
    })

    it('should allow multiple wildcards', () => {
      const users = collect([
        {
          name: 'John',
          roles: [
            {
              name: 'Editor',
            },
            {
              name: 'Admin',
            },
          ],
        },
      ])

      expect(users.pluck('*.*').all()).toEqual([[{ name: 'Editor' }, { name: 'Admin' }]])

      expect(users.pluck('*.*.*').all()).toEqual([['Editor', 'Admin']])
    })
  })

  describe('pop() method', () => {
    it('should remove and returns the last item from the collection', () => {
      const collection = collect([1, 2, 3, 4, 5])

      expect(collection.pop()).toEqual(5)
      expect(collection.all()).toEqual([1, 2, 3, 4])
    })

    it('should remove and returns the last n items from the collection', () => {
      const collection = collect([1, 2, 3, 4, 5])

      expect(collection.pop(2)).toEqual(collect([4, 5]))
      expect(collection.all()).toEqual([1, 2, 3])
    })

    it('should work when collection is an array of objects', () => {
      const collection = collect([
        {
          name: 'Darwin Núñez',
          club: 'Liverpool FC',
        },
        {
          name: 'Roberto Firmino',
          club: 'Liverpool FC',
        },
        {
          name: 'Mohamed Salah',
          club: 'Liverpool FC',
        },
      ])

      expect(collection.pop()).toEqual({
        name: 'Mohamed Salah',
        club: 'Liverpool FC',
      })

      expect(collection.all()).toEqual([
        {
          name: 'Darwin Núñez',
          club: 'Liverpool FC',
        },
        {
          name: 'Roberto Firmino',
          club: 'Liverpool FC',
        },
      ])
    })

    it('should return the last value when collection is based on an object', () => {
      const collection = collect({
        name: 'Mohamed Salah',
        club: 'Liverpool FC',
      })

      expect(collection.pop()).toEqual('Liverpool FC')

      expect(collection.all()).toEqual({
        name: 'Mohamed Salah',
      })
    })

    it('should return the last n values when collection is based on an object', () => {
      const collection = collect({
        name: 'Mohamed Salah',
        club: 'Liverpool FC',
        country: 'Egypt',
      })

      expect(collection.pop(2)).toEqual(
        collect({
          club: 'Liverpool FC',
          country: 'Egypt',
        }),
      )

      expect(collection.all()).toEqual({
        name: 'Mohamed Salah',
      })
    })

    it('should work with strings', () => {
      expect(collect('xoxo').pop()).toEqual('xoxo')
      expect(collect('xoxo').pop(20).first()).toEqual('xoxo')
    })

    it('should return null when popping an empty collection', () => {
      expect(collect().pop()).toEqual(null)
      expect(collect([]).pop()).toEqual(null)
      expect(collect({}).pop()).toEqual(null)
    })
  })

  describe('prepend() method', () => {
    it('should prepend an item to the beginning of the collection', () => {
      const collection = collect([1, 2, 3, 4, 5])

      expect(collection.prepend(0).all()).toEqual([0, 1, 2, 3, 4, 5])
      expect(collection.all()).toEqual([0, 1, 2, 3, 4, 5])
    })

    it('should work when collection is based on an object', () => {
      const collection2 = collect({
        firstname: 'Daniel',
      })

      expect(collection2.prepend('Eckermann', 'lastname').all()).toEqual({
        firstname: 'Daniel',
        lastname: 'Eckermann',
      })

      expect(collection2.all()).toEqual({
        lastname: 'Eckermann',
        firstname: 'Daniel',
      })
    })
  })

  describe('pull() method', () => {
    const player = {
      firstname: 'Darwin',
      lastname: 'Núñez',
    }

    it('should return the item at a given key and remove it from the collection', () => {
      const a = collect(player)
      const b = collect(player)

      expect(a.pull('firstname')).toEqual('Darwin')
      expect(a.all()).toEqual({ lastname: 'Núñez' })
      expect(b.all()).toEqual(player)
    })

    it('should return null if the key does not exist', () => {
      const collection = collect(player)
      expect(collection.pull('non-existing-key')).toEqual(null)
    })

    it('should accept a default value', () => {
      const collection = collect(player)
      const pulled = collection.pull('key-does-not-exist', 'Joe')

      expect(pulled).toEqual('Joe')
      expect(collection.all()).toEqual(player)
    })

    it('should accept a callback as the default value', () => {
      const collection = collect(player)
      const pulled = collection.pull('key-does-not-exist', () => 'Doe')

      expect(pulled).toEqual('Doe')
      expect(collection.all()).toEqual(player)
    })
  })

  describe('push() method', () => {
    it('should append an item to the end of the collection', () => {
      const collection = collect([1, 2, 3, 4])

      expect(collection.push(5).all()).toEqual([1, 2, 3, 4, 5])
    })

    it('should modify the collection', () => {
      const collection = collect([1, 2, 3, 4])
      expect(collection.all()).toEqual([1, 2, 3, 4])

      collection.push(5)
      expect(collection.all()).toEqual([1, 2, 3, 4, 5])
    })

    it('should work with spread operator', () => {
      const collection = collect([1, 2, 3, 4])
      expect(collection.all()).toEqual([1, 2, 3, 4])

      const values = [1, 2, 3, 4, 5]

      collection.push(...values)
      expect(collection.all()).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 5])
    })
  })

  describe('put() method', () => {
    it('should set the given key and value in the collection', () => {
      const collection = collect({ name: 'Roberto Firmino' })
      const modified = collection.put('club', 'Liverpool FC')

      expect(collection).toEqual(modified)
      expect(collection.all()).toEqual({
        name: 'Roberto Firmino',
        club: 'Liverpool FC',
      })
    })
  })

  describe('random() method', () => {
    it('should return a random item from the collection', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const random = collection.random()

      expect(random).toBeGreaterThanOrEqual(1)
      expect(random).toBeLessThanOrEqual(5)
      expect(collection.all().length).toEqual(5)
    })

    it('should return n random items from the collection', () => {
      const arrayOfRandomValues = collect([1, 2, 3, 4, 5]).random(3)

      expect(arrayOfRandomValues.all().length).toEqual(3)
      expect(arrayOfRandomValues.all()[0]).toBeGreaterThanOrEqual(1)
      expect(arrayOfRandomValues.all()[0]).toBeLessThanOrEqual(5)
      expect(arrayOfRandomValues.all()[1]).toBeGreaterThanOrEqual(1)
      expect(arrayOfRandomValues.all()[1]).toBeLessThanOrEqual(5)
      expect(arrayOfRandomValues.all()[2]).toBeGreaterThanOrEqual(1)
      expect(arrayOfRandomValues.all()[2]).toBeLessThanOrEqual(5)
      expect(arrayOfRandomValues.all()[3]).toEqual(undefined)
    })

    it('should return n random items from the collection, also when 1 is passed', () => {
      const arrayOfRandomValues = collect([1, 2, 3, 4, 5]).random(1)

      expect(arrayOfRandomValues.all().length).toEqual(1)
      expect(arrayOfRandomValues.all()[0]).toBeGreaterThanOrEqual(1)
      expect(arrayOfRandomValues.all()[0]).toBeLessThanOrEqual(5)
    })

    it('should not modify the collection', () => {
      const collection = collect([1, 2, 3, 4, 5, 8, 6])
      collection.random()
      expect(collection.all()).toEqual([1, 2, 3, 4, 5, 8, 6])
    })

    it('should work when collection is based on an object', () => {
      const collection = collect({
        first: 1,
        second: 2,
        third: 3,
        fourth: 4,
      })

      expect(collection.random()).toBeGreaterThanOrEqual(1)
      expect(collection.random()).toBeLessThanOrEqual(4)

      expect(collection.all()).toEqual({
        first: 1,
        second: 2,
        third: 3,
        fourth: 4,
      })
    })
  })

  describe('reduce() method', () => {
    it('should reduce the collection to a single value', () => {
      const collection = collect([1, 2, 3, 4, 5, 6, 7])
      const total = collection.reduce((carry, item) => carry + item)

      expect(total).toEqual(28)
    })

    it('should accept a default carry as the second argument', () => {
      const collection = collect([1, 2, 3, 4, 5, 6, 7])
      const total = collection.reduce((carry, item) => carry + item, 4)

      expect(total).toEqual(32)
      expect(collection.all()).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('should support hashmaps', () => {
      const collection = collect({ Joe: 'Doe', Foo: 'Bar' })
      const reduced = collection.reduce((carry, item, key) => carry + item + key, '')

      expect(reduced).toEqual('DoeJoeBarFoo')
      expect(collection.all()).toEqual({ Joe: 'Doe', Foo: 'Bar' })
    })

    it('should return 0 when reducing an empty collection', () => {
      const collection = collect([])
      const result = collection.reduce((carry, number) => carry + number, 0)

      expect(result).toEqual(0)
    })

    it('should return 1 when reducing an empty collection with carry of 1', () => {
      const collection = collect([])
      const result = collection.reduce((carry, number) => carry + number, 1)

      expect(result).toEqual(1)
    })
  })

  describe('reject() method', () => {
    it('should filter the collection using the given callback. removing items that returns true in the callback', () => {
      const collection = collect([1, 2, 3, 4])
      const filtered = collection.reject(value => value > 2)

      expect(filtered.all()).toEqual([1, 2])
      expect(collection.all()).toEqual([1, 2, 3, 4])
    })

    it('should not modify the collection', () => {
      const collection = collect([1, 2, 3, 4, 5, 6])
      const filtered = collection.reject(value => value > 2)

      expect(filtered.all()).toEqual([1, 2])
      expect(collection.all()).toEqual([1, 2, 3, 4, 5, 6])
    })

    it('should do the exact opposite of filter', () => {
      const collection = collect([1, 2, 3, 4])
      const filter = collection.filter(value => value > 2)
      const reject = collection.reject(value => value > 2)

      expect(filter.all()).toEqual([3, 4])
      expect(reject.all()).toEqual([1, 2])
    })

    it('should work on objects', () => {
      const collection = collect({
        player1: 'Darwin Núñez',
        player2: 'Philippe Coutinho',
      })

      const reject = collection.reject(value => value === 'Philippe Coutinho')

      expect(reject.all()).toEqual({
        player1: 'Darwin Núñez',
      })
    })
  })

  describe('replace() method', () => {
    it('doesnt replace anything when passing null', () => {
      const data = [1, 2, 3]
      const collection = collect(data)

      expect(collection.replace(null).all()).toEqual([1, 2, 3])
      expect(collection.all()).toEqual(data)
    })

    it('can replace values', () => {
      const data = ['a', 'b', 'c']
      const collection = collect(data)
      const replaced = collection.replace({
        1: 'd',
        2: 'e',
      })

      expect(replaced.all()).toEqual({
        0: 'a',
        1: 'd',
        2: 'e',
      })

      expect(collection.all()).toEqual(data)
    })

    it('can replace with an array', () => {
      const data = ['a', 'b', 'c']
      const collection = collect(data)
      const replaced = collection.replace([1, 2])

      expect(replaced.all()).toEqual([1, 2, 'c'])
      expect(collection.all()).toEqual(data)
    })

    it('can replace with an object', () => {
      const data = {
        name: 'Bob',
      }

      const collection = collect(data)
      const replaced = collection.replace({
        0: 9,
        name: 'John',
      })

      expect(replaced.all()).toEqual({
        0: 9,
        name: 'John',
      })

      expect(collection.all()).toEqual(data)
    })

    it('can replace with a collection', () => {
      const data = {
        name: 'Bob',
      }

      const collection = collect(data)
      const replaced = collection.replace(
        collect({
          0: 9,
          name: 'John',
        }),
      )

      expect(replaced.all()).toEqual({
        0: 9,
        name: 'John',
      })

      expect(collection.all()).toEqual(data)
    })
  })

  describe('replaceRecursive() method', () => {
    it('doesnt replace anything when passing null', () => {
      const data = [1, 2, [3, 4]]
      const collection = collect(data)

      expect(collection.replaceRecursive(null).all()).toEqual(data)
      expect(collection.all()).toEqual(data)
    })

    it('can do recursive replace', () => {
      const data = ['a', 'b', ['c', 'd']]
      const collection = collect(data)

      const replaced = collection.replaceRecursive({
        0: 'z',
        2: {
          1: 'e',
        },
      })

      expect(replaced.all()).toEqual({
        0: 'z',
        1: 'b',
        2: {
          0: 'c',
          1: 'e',
        },
      })

      expect(collection.all()).toEqual(data)
    })

    it('can do recursive replace an array', () => {
      const data = [1, 2, 3, [4, 5, 6]]
      const collection = collect(data)

      const replaced = collection.replaceRecursive([3, 2, 1, [4, 5, 6]])

      expect(replaced.all()).toEqual({
        0: 3,
        1: 2,
        2: 1,
        3: {
          0: 4,
          1: 5,
          2: 6,
        },
      })
      expect(collection.all()).toEqual(data)
    })

    it('can do recursive replace even though source is bigger than the target', () => {
      const data = [1, 2, 3, [4, 5, 6]]
      const collection = collect(data)

      const replaced = collection.replaceRecursive([1, 1, 1, 1, 1, 1, 1, 1, 1, 1])

      expect(replaced.all()).toEqual({
        0: 1,
        1: 1,
        2: 1,
        3: 1,
        4: 1,
        5: 1,
        6: 1,
        7: 1,
        8: 1,
        9: 1,
      })
      expect(collection.all()).toEqual(data)
    })

    it('can do recursive replace even though source is smaller than the target', () => {
      const data = [1, 2, 3, [4, 5, 6]]
      const collection = collect(data)

      const replaced = collection.replaceRecursive([8])

      expect(replaced.all()).toEqual({
        0: 8,
        1: 2,
        2: 3,
        3: {
          0: 4,
          1: 5,
          2: 6,
        },
      })
      expect(collection.all()).toEqual(data)
    })

    it('can do recursive replace with a string', () => {
      const data = [1, 2, 3, [4, 5, 6]]
      const collection = collect(data)

      const replaced = collection.replaceRecursive('x')

      expect(replaced.all()).toEqual({
        0: 'x',
        1: 2,
        2: 3,
        3: {
          0: 4,
          1: 5,
          2: 6,
        },
      })
      expect(collection.all()).toEqual(data)
    })

    it('can do recursive replace with an integer', () => {
      const data = [1, 2, 3, [4, 5, 6]]
      const collection = collect(data)

      const replaced = collection.replaceRecursive(11)

      expect(replaced.all()).toEqual({
        0: 11,
        1: 2,
        2: 3,
        3: {
          0: 4,
          1: 5,
          2: 6,
        },
      })
      expect(collection.all()).toEqual(data)
    })

    it('can do recursive replace with a collection', () => {
      const data = ['a', 'b', ['c', 'd']]
      const collection = collect(data)

      const replaced = collection.replaceRecursive(
        collect({
          0: 'z',
          2: {
            1: 'e',
          },
        }),
      )

      expect(replaced.all()).toEqual({
        0: 'z',
        1: 'b',
        2: {
          0: 'c',
          1: 'e',
        },
      })
      expect(collection.all()).toEqual(data)
    })

    it('should prove the readme test', () => {
      const collection = collect(['Matip', 'van Dijk', ['Núñez', 'Firmino', 'Salah']])

      const replaced = collection.replaceRecursive({
        0: 'Gomez',
        2: { 1: 'Origi' },
      })

      expect(replaced.all()).toEqual({
        0: 'Gomez',
        1: 'van Dijk',
        2: { 0: 'Núñez', 1: 'Origi', 2: 'Salah' },
      })

      expect(replaced.values().all()).toEqual([
        'Gomez',
        'van Dijk',
        {
          0: 'Núñez',
          1: 'Origi',
          2: 'Salah',
        },
      ])
    })
  })

  describe('reverse() method', () => {
    it('should reverse the order of the collection items', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const reversed = collection.reverse()

      expect(reversed.all()).toEqual([5, 4, 3, 2, 1])
    })

    it('should not modify the original collection', () => {
      const collection = collect(['a', 'b', 'c', 'd'])
      const reversed = collection.reverse()

      expect(reversed.all()).toEqual(['d', 'c', 'b', 'a'])
      expect(collection.all()).toEqual(['a', 'b', 'c', 'd'])
    })
  })

  describe('search() method', () => {
    it('should search the collection for the given value and returns its key if found', () => {
      const collection = collect([2, 4, 6, 8])
      expect(collection.search(4)).toEqual(1)
    })

    it('should return false if no items were found in array', () => {
      expect(collect([1, 2, 3]).search(5)).toEqual(false)
    })

    it('should return false if no items were found in array of objects', () => {
      const collection = collect([
        { id: 1, name: 'Test' },
        { id: 2, name: 'Test2' },
      ])

      expect(collection.search(item => item.id > 2)).toEqual(false)
    })

    it('should return false if no items were found in objec', () => {
      const collection = collect({
        name: 'Darwin Núñez',
        number: 27,
        club: 'Liverpool FC',
      })

      expect(collection.search('Roberto Firmino')).toEqual(false)
    })

    it('should search using a "loose" comparison', () => {
      const collection = collect([2, 4, '4', 6, 8])
      expect(collection.search('4')).toEqual(1)
    })

    it('should search using a "strict" comparison when passing true as the second argument', () => {
      const collection = collect([2, 4, '4', 6, 8])
      expect(collection.search('4', true)).toEqual(2)
    })

    it('should return false if the key is not found', () => {
      const collection = collect([2, 4, 6, 8])
      const result = collection.search('4', true)

      expect(result).toEqual(false)
    })

    it('should work when collection is based on an object', () => {
      const collection = collect({
        name: 'Darwin Núñez',
        number: 27,
        club: 'Liverpool FC',
      })

      expect(collection.search('Darwin Núñez')).toEqual('name')
      expect(collection.search('Darwin Nunez')).toEqual(false)

      expect(collection.search(27)).toEqual('number')
      expect(collection.search('27')).toEqual('number')
      expect(collection.search('27', true)).toEqual(false)

      expect(collection.search(item => item === 27)).toEqual('number')
    })

    it('should accept a custom callback and return the first value that passes', () => {
      const collection = collect([2, 4, 6, 8])

      expect(collection.search(item => item > 5)).toEqual(2)
      expect(collection.all()).toEqual([2, 4, 6, 8])
    })

    it('should find the index in an array of objects', () => {
      const collection = collect([
        { id: 1, name: 'Test' },
        { id: 2, name: 'Test2' },
      ])

      expect(collection.search(item => item.id > 1)).toEqual(1)
    })
  })

  describe('shift() method', () => {
    it('should return the first item and remove it from the collection', () => {
      const collection = collect([1, 2, 3, 4, 5])

      expect(collection.shift()).toEqual(1)
      expect(collection.all()).toEqual([2, 3, 4, 5])
    })

    it('should return the first n item and remove it from the collection', () => {
      const collection = collect([1, 2, 3, 4, 5])

      expect(collection.shift(2)).toEqual(collect([1, 2]))
      expect(collection.all()).toEqual([3, 4, 5])
    })

    it('should also work when the collection is based on an object', () => {
      const collection = collect({
        name: 'Mohamed Salah',
        number: 11,
      })

      expect(collection.shift()).toEqual('Mohamed Salah')
      expect(collection.all()).toEqual({ number: 11 })
    })

    it('should modify the collection, unlike first()', () => {
      const shiftCollection = collect({
        name: 'Mohamed Salah',
        number: 11,
      })

      const firstCollection = collect({
        name: 'Mohamed Salah',
        number: 11,
      })

      const shifted = shiftCollection.shift()
      const first = firstCollection.first()

      expect(shifted).toEqual(first)
      expect(shifted).toEqual('Mohamed Salah')

      expect(shiftCollection).not.toEqual(firstCollection)
      expect(shiftCollection.all()).toEqual({ number: 11 })
      expect(firstCollection.all()).toEqual({
        name: 'Mohamed Salah',
        number: 11,
      })
    })

    it('should return the first n values when collection is based on an object', () => {
      const collection = collect({
        name: 'Mohamed Salah',
        club: 'Liverpool FC',
        country: 'Egypt',
      })

      expect(collection.shift(2)).toEqual(
        collect({
          name: 'Mohamed Salah',
          club: 'Liverpool FC',
        }),
      )

      expect(collection.all()).toEqual({
        country: 'Egypt',
      })
    })

    it('should work with strings', () => {
      expect(collect('xoxo').shift()).toEqual('xoxo')
      expect(collect('xoxo').shift(20).first()).toEqual('xoxo')
    })

    it('should return null when shifting an empty collection', () => {
      expect(collect().shift()).toEqual(null)
      expect(collect([]).shift()).toEqual(null)
      expect(collect({}).shift()).toEqual(null)
    })
  })

  describe('shuffle() method', () => {
    it('should shuffle the items in the collection', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const shuffled = collection.shuffle()

      expect(shuffled.all().length).toEqual(5)
      expect(shuffled.all()[0]).toBeGreaterThanOrEqual(1)
      expect(shuffled.all()[0]).toBeLessThanOrEqual(5)
      expect(shuffled.all()[1]).toBeGreaterThanOrEqual(1)
      expect(shuffled.all()[1]).toBeLessThanOrEqual(5)
      expect(shuffled.all()[2]).toBeGreaterThanOrEqual(1)
      expect(shuffled.all()[2]).toBeLessThanOrEqual(5)
      expect(shuffled.all()[3]).toBeGreaterThanOrEqual(1)
      expect(shuffled.all()[3]).toBeLessThanOrEqual(5)
      expect(shuffled.all()[4]).toBeGreaterThanOrEqual(1)
      expect(shuffled.all()[4]).toBeLessThanOrEqual(5)

      expect(collection.all().length).toEqual(5)
      expect(collection.count()).toEqual(5)
    })

    it('should shuffle values when collection is based on an object', () => {
      const collection = collect({
        'qwe': 1,
        'xkx': 2,
        '681': 3,
        '--': 4,
        'xoxo': 5,
      })

      const shuffled = collection.shuffle()

      expect(shuffled.all().length).toEqual(5)
      expect(shuffled.all()[0]).toBeWithin(1, 5)
      expect(shuffled.all()[1]).toBeWithin(1, 5)
      expect(shuffled.all()[2]).toBeWithin(1, 5)
      expect(shuffled.all()[3]).toBeWithin(1, 5)
      expect(shuffled.all()[4]).toBeWithin(1, 5)

      expect(collection.all().length).toEqual(5)
      expect(collection.count()).toEqual(5)
    })
  })

  describe('skipUntil() method', () => {
    it('should skip all values before a given value appears', () => {
      const collection = collect([1, 1, 2, 2, 3, 3, 4, 4])

      expect(collection.skipUntil(3)).toEqual(collect([3, 3, 4, 4]))
      expect(collection.skipUntil(3).all()).toEqual([3, 3, 4, 4])

      expect(collection.skipUntil(1)).toEqual(collect([1, 1, 2, 2, 3, 3, 4, 4]))
      expect(collection.skipUntil(1).all()).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
    })

    it('should accept a callback', () => {
      const collection = collect([1, 2, 3, 4])

      const subset = collection.skipUntil(item => item >= 3)

      expect(subset.all()).toEqual([3, 4])
    })

    it('should work with collection based on an object', () => {
      const collection = collect({
        name: 'Darwin Núñez',
        number: 27,
        club: 'Liverpool FC',
      })

      expect(collection.skipUntil('Liverpool FC')).toEqual(
        collect({
          club: 'Liverpool FC',
        }),
      )
      expect(collection.skipUntil('Liverpool FC').all()).toEqual({
        club: 'Liverpool FC',
      })

      expect(collection.skipUntil('Darwin Núñez').isNotEmpty()).toEqual(true)
      expect(collection.skipUntil('Darwin Núñez').all()).toEqual({
        club: 'Liverpool FC',
        name: 'Darwin Núñez',
        number: 27,
      })
    })

    it('should work when multidimentional', () => {
      const data = [
        {
          name: 'Darwin Núñez',
          number: 27,
          club: 'Liverpool FC',
        },
        {
          name: 'Mohamed Salah',
          number: 11,
          club: 'Liverpool FC',
        },
      ]

      const collection = collect(data)

      expect(collection.skipUntil('Liverpool FC').isEmpty()).toEqual(true)
      expect(collection.skipUntil('Liverpool FC')).toEqual(collect())
      expect(collection.skipUntil('Liverpool FC').all()).toEqual([])
    })
  })

  describe('skipWhile() method', () => {
    it('should skip all values before a given value appears', () => {
      const collection = collect([1, 1, 2, 2, 3, 3, 4, 4])

      expect(collection.skipWhile(1)).toEqual(collect([2, 2, 3, 3, 4, 4]))
      expect(collection.skipWhile(1).all()).toEqual([2, 2, 3, 3, 4, 4])
    })

    it('should accept a callback', () => {
      const collection = collect([1, 2, 3, 4])

      const subset = collection.skipWhile(item => item <= 3)

      expect(subset.all()).toEqual([4])
    })

    it('should work with collection based on an object', () => {
      const collection = collect({
        name: 'Darwin Núñez',
        number: 27,
        club: 'Liverpool FC',
      })

      expect(collection.skipWhile('Liverpool FC')).toEqual(
        collect({
          name: 'Darwin Núñez',
          number: 27,
          club: 'Liverpool FC',
        }),
      )
      expect(collection.skipWhile('Liverpool FC').all()).toEqual({
        name: 'Darwin Núñez',
        number: 27,
        club: 'Liverpool FC',
      })

      expect(collection.skipWhile('Darwin Núñez').isNotEmpty()).toEqual(true)
      expect(collection.skipWhile('Darwin Núñez').all()).toEqual({
        club: 'Liverpool FC',
        number: 27,
      })
    })

    it('should work when multidimensional', () => {
      const data = [
        {
          name: 'Darwin Núñez',
          number: 27,
          club: 'Liverpool FC',
        },
        {
          name: 'Mohamed Salah',
          number: 11,
          club: 'Liverpool FC',
        },
      ]

      const collection = collect(data)

      expect(collection.skipWhile('Liverpool FC')).toEqual(collect(data))
      expect(collection.skipWhile('Liverpool FC').all()).toEqual(data)
    })
  })

  describe('skip() method', () => {
    it('should skip n number of items', () => {
      const collection = collect([1, 2, 3, 4, 5])

      expect(collection.skip(4).all()).toEqual([5])
    })

    it('should skip n number of items when object', () => {
      const collection = collect({
        first: 'first',
        second: 'second',
        third: 'third',
        fourth: 'fourth',
        fifth: 'fifth',
      })

      expect(collection.skip(4).all()).toEqual({
        fifth: 'fifth',
      })
    })
  })

  describe('slice() method', () => {
    it('should return a slice of the collection starting at the given index', () => {
      const collection = collect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      const slice = collection.slice(4)

      expect(slice.all()).toEqual([5, 6, 7, 8, 9, 10])
    })

    it('should not modify the original collection', () => {
      const collection = collect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      const slice = collection.slice(4)

      expect(slice.all()).toEqual([5, 6, 7, 8, 9, 10])
      expect(collection.all()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    it('should accept a max limit as the second argument', () => {
      const collection2 = collect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      const slice2 = collection2.slice(4, 2)

      expect(slice2.all()).toEqual([5, 6])
      expect(collection2.all()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })
  })

  describe('sole() method', () => {
    it('should return first item in collection if only one exists', () => {
      const collection = collect([{ name: 'foo' }, { name: 'bar' }])

      expect(collection.where('name', 'foo').sole()).toDeepEqual({ name: 'foo' })
      expect(collection.sole('name', '=', 'foo')).toDeepEqual({ name: 'foo' })
      expect(collection.sole('name', 'foo')).toDeepEqual({ name: 'foo' })
    })

    it('should throw error if no items exist', () => {
      const collection = collect([{ name: 'foo' }, { name: 'bar' }])

      expect(() => {
        collection.where('name', 'INVALID').sole()
      }).toThrow('Item not found.')
    })

    it('should throw error if more than one item exists', () => {
      const collection = collect([{ name: 'foo' }, { name: 'foo' }, { name: 'bar' }])

      expect(() => {
        collection.where('name', 'foo').sole()
      }).toThrow('Multiple items found.')
    })

    it('should return first item in collection if only one exists with callback', () => {
      const collection = collect(['foo', 'bar', 'baz'])

      const result = collection.sole(value => value === 'bar')

      expect(result).toEqual('bar')
    })

    it('should throw error if no items exist with callback', () => {
      const collection = collect(['foo', 'bar', 'baz'])

      expect(() => {
        collection.sole(value => value === 'invalid')
      }).toThrow('Item not found.')
    })

    it('should throw error if more than one items exist with callback', () => {
      const collection = collect(['foo', 'bar', 'bar'])

      expect(() => {
        collection.sole(value => value === 'bar')
      }).toThrow('Multiple items found.')
    })
  })

  describe('some() method', () => {
    it('should return whether the collection contains a given item', () => {
      const collection = collect({
        name: 'Steven Gerrard',
        number: 8,
      })

      const contains = collection.some('name')

      expect(contains).toEqual(true)

      expect(collection.all()).toEqual({
        name: 'Steven Gerrard',
        number: 8,
      })

      const collection2 = collect({
        name: 'Steven Gerrard',
        number: 8,
      })

      const contains2 = collection2.some('spouse')
      expect(contains2).toEqual(false)
      expect(collection2.all()).toEqual({
        name: 'Steven Gerrard',
        number: 8,
      })
    })

    it('should accept a key / value pair', () => {
      const collection = collect({
        name: 'Steven Gerrard',
        number: 8,
      })

      const contains = collection.some('name', 'Steven Gerrard')
      expect(contains).toEqual(true)

      const contains2 = collection.some('number', '8')
      expect(contains2).toEqual(false)

      const contains3 = collection.some('number', 28)
      expect(contains3).toEqual(false)

      const contains4 = collection.some('name', 'Steve Jobs')
      expect(contains4).toEqual(false)
    })

    it('should work with an collection with an array of objects', () => {
      const collection = collect([
        {
          name: 'Steven Gerrard',
          number: 8,
        },
        {
          name: 'Steve Jobs',
          number: 2,
        },
      ])

      expect(collection.some('name')).toEqual(false)
      expect(collection.some('name', 'Steven Gerrard')).toEqual(true)
      expect(collection.some('name', 'Gerrard')).toEqual(false)
    })

    it('should accept a closure', () => {
      const collection = collect([1, 2, 3, 4, 5])

      const contains = collection.some(value => value > 5)
      expect(contains).toEqual(false)

      const contains2 = collection.some(value => value < 5)
      expect(contains2).toEqual(true)

      const collection3 = collect([1, 2, 3, 4])
      expect(collection3.some(4)).toEqual(true)
    })

    it('should return whether the collection contains a given key', () => {
      const collection = collect({
        name: 'Mohamed Salah',
        number: 11,
      })

      expect(collection.some('name')).toEqual(true)
      expect(collection.some('Mohamed Salah')).toEqual(true)
      expect(collection.some('number')).toEqual(true)
      expect(collection.some(11)).toEqual(true)
    })
  })

  describe('sort() method', () => {
    it('should reverse sort the collection by the given key', () => {
      const collection = collect([
        { name: 'Desk', price: 200 },
        { name: 'Chair', price: 100 },
        { name: 'Bookcase', price: 150 },
      ])

      const sorted = collection.sortByDesc('price')

      expect(sorted.all()).toEqual([
        { name: 'Desk', price: 200 },
        { name: 'Bookcase', price: 150 },
        { name: 'Chair', price: 100 },
      ])
    })

    it('should accept a custom sort function', () => {
      const collection2 = collect([
        { name: 'Bookcase', colors: ['Red', 'Beige', 'Brown'] },
        { name: 'Chair', colors: ['Black'] },
        { name: 'Desk', colors: ['Black', 'Mahogany'] },
      ])

      const sorted2 = collection2.sortByDesc(product => product.colors.length)

      expect(sorted2.all()).toEqual([
        { name: 'Bookcase', colors: ['Red', 'Beige', 'Brown'] },
        { name: 'Desk', colors: ['Black', 'Mahogany'] },
        { name: 'Chair', colors: ['Black'] },
      ])

      expect(collection2.all()).toEqual([
        { name: 'Bookcase', colors: ['Red', 'Beige', 'Brown'] },
        { name: 'Chair', colors: ['Black'] },
        { name: 'Desk', colors: ['Black', 'Mahogany'] },
      ])
    })
  })

  describe('sortBy() method', () => {
    const data = [
      { name: 'Desk', price: 200 },
      { name: 'Chair', price: 100 },
      { name: 'Bookcase', price: 150 },
    ]

    it('should sort the collection by the given key', () => {
      const collection = collect(data)
      const sorted = collection.sortBy('price')

      expect(sorted.all()).toEqual([
        { name: 'Chair', price: 100 },
        { name: 'Bookcase', price: 150 },
        { name: 'Desk', price: 200 },
      ])
    })

    it('should not modify the collection', () => {
      const collection = collect(data)
      const sorted = collection.sortBy('price')

      expect(sorted.all()).toEqual([
        { name: 'Chair', price: 100 },
        { name: 'Bookcase', price: 150 },
        { name: 'Desk', price: 200 },
      ])
      expect(collection.all()).toEqual(data)
    })

    it('should accept a custom sort function', () => {
      const collection = collect([
        { name: 'Desk', colors: ['Black', 'Mahogany'] },
        { name: 'Chair', colors: ['Black'] },
        { name: 'Bookcase', colors: ['Red', 'Beige', 'Brown'] },
      ])

      const sorted = collection.sortBy(product => product.colors.length)

      expect(sorted.all()).toEqual([
        { name: 'Chair', colors: ['Black'] },
        { name: 'Desk', colors: ['Black', 'Mahogany'] },
        { name: 'Bookcase', colors: ['Red', 'Beige', 'Brown'] },
      ])

      expect(collection.all()).toEqual([
        { name: 'Desk', colors: ['Black', 'Mahogany'] },
        { name: 'Chair', colors: ['Black'] },
        { name: 'Bookcase', colors: ['Red', 'Beige', 'Brown'] },
      ])
    })

    it('should sort strings before integers and integers before null', () => {
      const collection = collect([{ order: '1971-11-13T23:00:00.000000Z' }, { order: null }, { order: 1 }])

      const sorted = collection.sortBy('order')

      expect(sorted.all()).toEqual([{ order: '1971-11-13T23:00:00.000000Z' }, { order: 1 }, { order: null }])
    })

    it('should sort strings before integers and integers before null', () => {
      const collection = collect([{ order: '1' }, { order: null }, { order: 1 }])

      const sorted = collection.sortBy('order')

      expect(sorted.all()).toEqual([{ order: '1' }, { order: 1 }, { order: null }])
    })

    it('should sort strings before integers and integers before null when using a callback function', () => {
      const collection = collect([{ order: '1971-11-13T23:00:00.000000Z' }, { order: null }, { order: 1 }])

      const sorted = collection.sortBy(item => item.order)

      expect(sorted.all()).toEqual([{ order: '1971-11-13T23:00:00.000000Z' }, { order: 1 }, { order: null }])
    })

    it('should sort nested data with dot notation', () => {
      const collection = collect([
        { nested: { data: '1971-11-13T23:00:00.000000Z' } },
        { nested: { data: null } },
        { nested: { data: 1 } },
      ])

      const sorted = collection.sortBy('nested.data')

      expect(sorted.all()).toEqual([
        { nested: { data: '1971-11-13T23:00:00.000000Z' } },
        { nested: { data: 1 } },
        { nested: { data: null } },
      ])
    })
  })

  describe('sortDesc() method', () => {
    it('should sort the collection', () => {
      const collection = collect([5, 3, 1, 2, 10, 4])
      const sorted = collection.sortDesc()

      expect(sorted.all()).toEqual([10, 5, 4, 3, 2, 1])
    })

    it('should sort a collection of characters', () => {
      const collection = collect(['c', 'a', 'b'])
      const sorted = collection.sortDesc()

      expect(sorted.all()).toEqual(['c', 'b', 'a'])
    })

    it('should not modify the collection', () => {
      const collection = collect([5, 3, 1, 2, 10, 4])
      const sorted = collection.sortDesc()

      expect(sorted.all()).toEqual([10, 5, 4, 3, 2, 1])
      expect(collection.all()).toEqual([5, 3, 1, 2, 10, 4])
    })
  })

  describe('sortKeyDesc method', () => {
    it('should sort the keys in the collection', () => {
      const collection = collect({
        a: 1,
        b: 2,
        c: 3,
      })

      expect(collection.sortKeysDesc().all()).toEqual({
        c: 3,
        b: 2,
        a: 1,
      })
    })

    it('should return the same collection if not an object', () => {
      expect(collect('foo').all()).toEqual(['foo'])
      expect(collect([1, 2, 3]).all()).toEqual([1, 2, 3])
      expect(collect(null).all()).toEqual([])
    })
  })

  describe('sortKeys() method', () => {
    it('should sort the keys in the collection', () => {
      const collection = collect({
        c: 3,
        b: 2,
        a: 1,
      })

      expect(collection.sortKeys().all()).toEqual({
        a: 1,
        b: 2,
        c: 3,
      })
    })

    it('should return the same collection if not an object', () => {
      expect(collect('foo').all()).toEqual(['foo'])
      expect(collect([1, 2, 3]).all()).toEqual([1, 2, 3])
      expect(collect(null).all()).toEqual([])
    })
  })

  describe('sort() method', () => {
    it('should sort the collection', () => {
      const collection = collect([5, 3, 1, 2, 10, 4])
      const sorted = collection.sort()

      expect(sorted.all()).toEqual([1, 2, 3, 4, 5, 10])
    })

    it('should sort a collection of characters', () => {
      const collection = collect(['c', 'a', 'b'])
      const sorted = collection.sort()

      expect(sorted.all()).toEqual(['a', 'b', 'c'])
    })

    it('should not modify the collection', () => {
      const collection = collect([5, 3, 1, 2, 10, 4])
      const sorted = collection.sort()

      expect(sorted.all()).toEqual([1, 2, 3, 4, 5, 10])
      expect(collection.all()).toEqual([5, 3, 1, 2, 10, 4])
    })

    it('should accept a custom sort function', () => {
      const collection = collect([5, 3, 1, 2, 4])
      const sorted = collection.sort((a, b) => b - a)

      expect(sorted.all()).toEqual([5, 4, 3, 2, 1])
      expect(collection.all()).toEqual([5, 3, 1, 2, 4])
    })
  })

  describe('splice() method', () => {
    it('should remove and return a slice of items starting at the specified index', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const chunk = collection.splice(2)
      expect(chunk.all()).toEqual([3, 4, 5])
      expect(collection.all()).toEqual([1, 2])

      const collection2 = collect([1, 2, 3, 4, 5])
      const chunk2 = collection2.splice(2, 1, [10, 11])
      expect(chunk2.all()).toEqual([3])
      expect(collection2.all()).toEqual([1, 2, 10, 11, 4, 5])
    })

    it('should modify the collection', () => {
      const collection = collect([1, 2, 3, 4, 5])
      const chunk = collection.splice(2, 1)
      expect(chunk.all()).toEqual([3])
      expect(collection.all()).toEqual([1, 2, 4, 5])
    })
  })

  describe('split() method', () => {
    it('should return a collection of collections', () => {
      const collection = collect([1, 2, 3, 4, 5])

      expect(collection.split(2)).toEqual(collect([collect([1, 2, 3]), collect([4, 5])]))
    })

    it('should split a collection into the given number of collections', () => {
      const collection = collect([1, 2, 3, 4, 5])

      expect(collection.split(2).all()).toEqual([collect([1, 2, 3]), collect([4, 5])])
    })
  })

  describe('sum() method', () => {
    it('should return the sum of collection values', () => {
      expect(collect([1, 3, 3, 7]).sum()).toEqual(14)
      expect(collect([1, 3, 3, 7]).unique().sum()).toEqual(11)
    })

    it('should return the sum of collection values by key', () => {
      const collection = collect([
        { name: 'JavaScript The Good Parts', pages: 176 },
        { name: 'JavaScript The Definitive Guide', pages: 1096 },
      ])

      expect(collection.sum('pages')).toEqual(1272)
    })

    it('should return the sum of the provided closure', () => {
      const collection = collect([
        { name: 'Desk', colors: ['Black', 'Mahogany'] },
        { name: 'Chair', colors: ['Black'] },
        { name: 'Bookcase', colors: ['Red', 'Beige', 'Brown'] },
      ])

      const summed = collection.sum(product => product.colors.length)

      expect(summed).toEqual(6)

      expect(collection.all()).toEqual([
        { name: 'Desk', colors: ['Black', 'Mahogany'] },
        { name: 'Chair', colors: ['Black'] },
        { name: 'Bookcase', colors: ['Red', 'Beige', 'Brown'] },
      ])
    })

    it('should return sum of closure when collection is object with objects', () => {
      const collection = collect({
        S: { ordered: 10, deliverd: 5 },
        M: { ordered: 20, deliverd: 5 },
        L: { ordered: 15, deliverd: 10 },
      })

      const summed = collection.sum(item => item.ordered)

      expect(summed).toEqual(45)

      expect(collection.all()).toEqual({
        S: { ordered: 10, deliverd: 5 },
        M: { ordered: 20, deliverd: 5 },
        L: { ordered: 15, deliverd: 10 },
      })
    })

    it('should strip a number to nearest right number', () => {
      // Issue: https://github.com/ecrmnn/collect.js/issues/245
      // Solution: https://github.com/nefe/number-precision/blob/master/src/index.ts#L10
      expect(collect([0.1, 0.2]).sum()).toEqual(0.3)
      expect(collect([1.0 - 0.9]).sum()).toEqual(0.1)
    })

    it('should parse strings to numbers', () => {
      expect(collect(['5', '5']).sum()).toEqual(10)
      expect(collect(['0.1', '0.2']).sum()).toEqual(0.3)
      expect(collect(['1.0' - '0.9']).sum()).toEqual(0.1)
    })
  })

  describe('symbolIterator test', () => {
    it('should be iterable', () => {
      let result = ''

      for (const item of collect([1, 2, 3, 4, 5])) {
        result += item
      }

      expect(result).toEqual('12345')

      const result2 = []
      const clubs = collect([{ name: 'Liverpool' }, { name: 'Arsenal' }, { name: 'Chelsea' }])

      for (const club of clubs) {
        result2.push(club)
      }

      expect(result2).toEqual(clubs.all())
    })
  })

  describe('takeUntil() method', () => {
    it('should take values', () => {
      const collection = collect([1, 2, 3, 4])

      expect(collection.takeUntil(3)).toEqual(collect([1, 2]))
      expect(collection.takeUntil(3).all()).toEqual([1, 2])

      expect(collection.takeUntil(1)).toEqual(collect([]))
      expect(collection.takeUntil(1).all()).toEqual([])
    })

    it('should accept a callback', () => {
      const collection = collect([1, 2, 3, 4])

      const subset = collection.takeUntil(item => item >= 3)

      expect(subset.all()).toEqual([1, 2])
    })

    it('should work with collection based on an object', () => {
      const collection = collect({
        name: 'Darwin Núñez',
        number: 27,
        club: 'Liverpool FC',
      })

      expect(collection.takeUntil('Liverpool FC')).toEqual(
        collect({
          name: 'Darwin Núñez',
          number: 27,
        }),
      )
      expect(collection.takeUntil('Liverpool FC').all()).toEqual({
        name: 'Darwin Núñez',
        number: 27,
      })

      expect(collection.takeUntil('Darwin Núñez').isEmpty()).toEqual(true)
      expect(collection.takeUntil('Darwin Núñez').all()).toEqual({})
    })

    it('should work when multidimentional', () => {
      const data = [
        {
          name: 'Darwin Núñez',
          number: 27,
          club: 'Liverpool FC',
        },
        {
          name: 'Mohamed Salah',
          number: 11,
          club: 'Liverpool FC',
        },
      ]

      const collection = collect(data)

      expect(collection.takeUntil('Liverpool FC')).toEqual(collect(data))
      expect(collection.takeUntil('Liverpool FC').all()).toEqual(data)
    })
  })

  describe('takeWhile() method', () => {
    it('should take values', () => {
      const collection = collect([1, 2, 3, 4])

      expect(collection.takeWhile(1)).toEqual(collect([1]))
      expect(collection.takeWhile(1).all()).toEqual([1])

      expect(collection.takeWhile(2)).toEqual(collect([]))
      expect(collection.takeWhile(2).all()).toEqual([])
    })

    it('should accept a callback', () => {
      const collection = collect([1, 2, 3, 4])

      const subset = collection.takeWhile(item => item < 3)

      expect(subset.all()).toEqual([1, 2])
    })

    it('should work with collection based on an object', () => {
      const collection = collect({
        name: 'Darwin Núñez',
        number: 27,
        club: 'Liverpool FC',
      })

      expect(collection.takeWhile('Liverpool FC')).toEqual(collect({}))
      expect(collection.takeWhile('Liverpool FC').all()).toEqual({})

      expect(collection.takeWhile('Darwin Núñez').isNotEmpty()).toEqual(true)
      expect(collection.takeWhile('Darwin Núñez').all()).toEqual({
        name: 'Darwin Núñez',
      })
    })

    it('should work when multidimentional', () => {
      const data = [
        {
          name: 'Darwin Núñez',
          number: 27,
          club: 'Liverpool FC',
        },
        {
          name: 'Mohamed Salah',
          number: 11,
          club: 'Liverpool FC',
        },
      ]

      const collection = collect(data)

      expect(collection.takeWhile('Liverpool FC')).toEqual(collect([]))
      expect(collection.takeWhile('Liverpool FC').all()).toEqual([])
    })
  })

  describe('take() method', () => {
    it('should return a new collection with the specified number of items', () => {
      const collection = collect([0, 1, 2, 3, 4, 5])
      const chunk = collection.take(3)

      expect(chunk.all()).toEqual([0, 1, 2])
      expect(collection.all()).toEqual([0, 1, 2, 3, 4, 5])
    })

    it('should take from the end of the collection when passed a negative integer', () => {
      const collection = collect([0, 1, 2, 3, 4, 5])
      const chunk = collection.take(-2)

      expect(chunk.all()).toEqual([4, 5])
      expect(collection.all()).toEqual([0, 1, 2, 3, 4, 5])
    })

    it('should work when the collection is based on an object', () => {
      const collection = collect({
        name: 'Darwin Núñez',
        number: 27,
        club: 'Liverpool FC',
      })

      const chunk = collection.take(1)
      expect(chunk.all()).toEqual({ name: 'Darwin Núñez' })

      const chunk2 = collection.take(-1)
      expect(chunk2.all()).toEqual({ club: 'Liverpool FC' })

      expect(collection.all()).toEqual({
        name: 'Darwin Núñez',
        number: 27,
        club: 'Liverpool FC',
      })
    })
  })

  describe('tap() method', () => {
    it('should passes the collection to the given callback', () => {
      let tapped = null

      const number = collect([2, 4, 3, 1, 5])
        .sort()
        .tap((collection) => {
          tapped = collection.all()
        })
        .shift()

      expect(tapped).toEqual([2, 3, 4, 5])
      expect(number).toEqual(1)
    })

    it('should work when collection is based on an object', () => {
      const data = {
        name: 'Mohamed Salah',
        number: 11,
        club: 'Liverpool FC',
      }

      let tapped = null

      collect(data).tap((collection) => {
        tapped = collection.all()
      })

      expect(tapped).toEqual(data)
    })
  })

  describe('times() method', () => {
    it('should create a new collection by invoking the callback a given amount of times', () => {
      const collection = collect().times(10, number => number * 9)

      expect(collection.all()).toEqual([9, 18, 27, 36, 45, 54, 63, 72, 81, 90])
    })
  })

  describe('toArray() method', () => {
    it('should convert the collection into a plain array', () => {
      const collectionArray = collect([1, 2, 3, 'b', 'c', 'ø'])

      expect(collectionArray.toArray()).toEqual([1, 2, 3, 'b', 'c', 'ø'])
      expect(collectionArray.toArray()).toEqual(collectionArray.all())

      const collectionObject = collect({
        name: 'Elon Musk',
        companies: ['Tesla', 'Space X', 'SolarCity'],
      })

      expect(collectionObject.toArray()).toEqual(['Elon Musk', ['Tesla', 'Space X', 'SolarCity']])
      expect(collectionObject.toArray()).toEqual(collectionObject.values().all())
    })

    it('should cast simple collection to an array', () => {
      const collectionOfCollections = collect([1, 2, 'LFC'])

      expect(collectionOfCollections.toArray()).toEqual([1, 2, 'LFC'])
    })

    it('should recursively cast a collection of arrays to an array', () => {
      const collectionOfCollections = collect([
        [1, 2, 3],
        [4, 5, 6],
      ])

      expect(collectionOfCollections.toArray()).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ])
    })

    it('should recursively work on a collection of collections', () => {
      const collectionOfCollections = collect([collect(['foo']), collect(['bar'])])

      expect(collectionOfCollections.toArray()).toEqual([['foo'], ['bar']])
    })

    it('should recursively cast collections to an array', () => {
      const collectionOfCollections = collect([
        collect([1, 2, 3]),
        collect([4, 5, 6, collect([7, 8, 9]), [10, 11, 12]]),
      ])

      expect(collectionOfCollections.toArray()).toEqual([
        [1, 2, 3],
        [4, 5, 6, [7, 8, 9], [10, 11, 12]],
      ])
    })
  })

  describe('toJson() method', () => {
    it('should return a JSON representation of the collection', () => {
      const firstChildCollection = collect(['foo'])
      const secondChildCollection = collect(['bar'])
      const collection = collect([firstChildCollection, secondChildCollection])

      expect(collection.toJson()).toEqual('[["foo"],["bar"]]')
    })

    it('should recursively cast collections to JSON', () => {
      const collectionOfCollections = collect([
        collect([1, 2, 3]),
        collect([4, 5, 6, collect([7, 8, 9]), [10, 11, 12]]),
      ])

      expect(collectionOfCollections.toJson()).toEqual('[[1,2,3],[4,5,6,[7,8,9],[10,11,12]]]')
    })

    it('should cast objects to JSON', () => {
      const collection = collect({
        string: 'abc',
      })

      expect(collection.toJson()).toEqual('{"string":"abc"}')
    })

    it('should be compatible with JSON.stringify()', () => {
      /*
    JSON.stringify() looks for a toJSON() method. Note the capitalization difference.
    https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
    */
      const collection = collect({
        string: 'abc',
      })

      expect(JSON.stringify(collection)).toEqual(collection.toJson())
    })
  })

  describe('transform() method', () => {
    it('should return the modified collection', () => {
      const collection = collect([1, 2, 3, 4])

      const transformed = collection.transform(i => i * 2).transform(i => i * 2)

      expect(transformed).toEqual(collection)
      expect(transformed.all()).toEqual([4, 8, 12, 16])
    })

    it('should iterate over the collection and transform it', () => {
      const collection = collect({
        foo: 1,
        bar: 2,
        baz: 3,
      })

      collection.transform(item => item * 2)

      expect(collection.all()).toEqual({
        foo: 2,
        bar: 4,
        baz: 6,
      })
    })

    it('should work exactly like map, but modify the collection', () => {
      const tCollection = collect([1, 2, 3])
      const transformed = tCollection.transform(i => i * 5)

      expect(tCollection).toEqual(transformed)
      expect(tCollection.all()).toEqual([5, 10, 15])
      expect(transformed.all()).toEqual([5, 10, 15])

      const mCollection = collect([1, 2, 3])
      const mapped = mCollection.map(i => i * 5)

      expect(mCollection).not.toEqual(mapped)
      expect(mCollection.all()).toEqual([1, 2, 3])
      expect(mapped.all()).toEqual([5, 10, 15])
    })
  })

  describe('undot() method', () => {
    it('should undot keyed collection', () => {
      const collection = collect({
        'name': 'Taylor',
        'meta.foo': 'bar',
        'meta.baz': ['boom', 'boom', 'boom'],
        'meta.bam.boom': 'bip',
      })

      expect(collection.undot().all()).toEqual({
        name: 'Taylor',
        meta: {
          foo: 'bar',
          baz: ['boom', 'boom', 'boom'],
          bam: {
            boom: 'bip',
          },
        },
      })
    })

    it('should undot indexed collection', () => {
      const collection = collect({
        'foo.0': 'bar',
        'foo.1': 'baz',
        'foo.baz': 'boom',
      })

      expect(collection.undot().all()).toEqual({
        foo: {
          0: 'bar',
          1: 'baz',
          baz: 'boom',
        },
      })
    })

    it('should undot documentation example', () => {
      const person = collect({
        'name.first_name': 'Marie',
        'name.last_name': 'Valentine',
        'address.line_1': '2992 Eagle Drive',
        'address.line_2': '',
        'address.suburb': 'Detroit',
        'address.state': 'MI',
        'address.postcode': '48219',
      })

      const undotted = person.undot()

      const all = undotted.all()

      const expected = {
        name: {
          first_name: 'Marie',
          last_name: 'Valentine',
        },
        address: {
          line_1: '2992 Eagle Drive',
          line_2: '',
          suburb: 'Detroit',
          state: 'MI',
          postcode: '48219',
        },
      }

      expect(all).toEqual(expected)
    })

    it('should ignore array based collections', () => {
      const data = ['name.first', 'name.last', 'xoxo']

      const collection = collect(data)

      expect(collection.undot().all()).toEqual(data)
    })
  })

  describe('union() method', () => {
    it('should add the given object to the collection. '
      + 'If the given object contains keys that are already in the collection, '
      + 'the collections values will be preferred', () => {
      const collection = collect({
        a: 'A',
        b: 'B',
      })

      const union = collection.union({
        a: 'AAA',
        c: 'CCC',
        b: 'BBB',
      })

      expect(union.all()).toEqual({
        a: 'A',
        b: 'B',
        c: 'CCC',
      })

      expect(collection.all()).toEqual({
        a: 'A',
        b: 'B',
      })

      expect(union.all().b).toEqual('B')

      union.forget('b')

      expect(union.all().b).toEqual(undefined)
    })
  })

  describe('unique() method', () => {
    it('should return an array of unique items', () => {
      const collection1 = collect([1, 1, 1, 2, 3, 3])
      expect(collection1.unique().all()).toEqual([1, 2, 3])

      const collection2 = collect([1, 1, 1, 2, 3, 3, '3'])
      expect(collection2.unique().all()).toEqual([1, 2, 3, '3'])
    })

    it('should return an array of unique objects by key', () => {
      const collection = collect([
        {
          name: 'iPhone 6',
          brand: 'Apple',
          type: 'phone',
          price: 999,
        },
        {
          name: 'iPhone 5',
          brand: 'Apple',
          type: 'phone',
          price: '999',
        },
        {
          name: 'Apple Watch',
          brand: 'Apple',
          type: 'watch',
          price: 1999,
        },
        {
          name: 'Galaxy S6',
          brand: 'Samsung',
          type: 'phone',
          price: 1999,
        },
        {
          name: 'Galaxy Gear',
          brand: 'Samsung',
          type: 'watch',
          price: 999,
        },
      ])

      const unique = collection.unique('price')

      expect(unique.all()).toEqual([
        {
          name: 'iPhone 6',
          brand: 'Apple',
          type: 'phone',
          price: 999,
        },
        {
          name: 'iPhone 5',
          brand: 'Apple',
          type: 'phone',
          price: '999',
        },
        {
          name: 'Apple Watch',
          brand: 'Apple',
          type: 'watch',
          price: 1999,
        },
      ])
    })

    it('should return an array of unique objects by callback', () => {
      const collection = collect([
        {
          name: 'iPhone 6',
          brand: 'Apple',
          type: 'phone',
          price: 999,
        },
        {
          name: 'iPhone 5',
          brand: 'Apple',
          type: 'phone',
          price: '999',
        },
        {
          name: 'Apple Watch',
          brand: 'Apple',
          type: 'watch',
          price: 1999,
        },
        {
          name: 'Galaxy S6',
          brand: 'Samsung',
          type: 'phone',
          price: 1999,
        },
        {
          name: 'Galaxy Gear',
          brand: 'Samsung',
          type: 'watch',
          price: 999,
        },
      ])

      const unique = collection.unique(item => item.brand + item.price)

      expect(unique.all()).toEqual([
        {
          name: 'iPhone 6',
          brand: 'Apple',
          type: 'phone',
          price: 999,
        },
        {
          name: 'Apple Watch',
          brand: 'Apple',
          type: 'watch',
          price: 1999,
        },
        {
          name: 'Galaxy S6',
          brand: 'Samsung',
          type: 'phone',
          price: 1999,
        },
        {
          name: 'Galaxy Gear',
          brand: 'Samsung',
          type: 'watch',
          price: 999,
        },
      ])
    })
  })

  describe('unless() method', () => {
    it('should execute the given callback when the first argument given to the method evaluates to false', () => {
      const collection = collect([1, 2, 3])

      collection.unless(false, (c) => {
        c.push(4)
      })

      expect(collection.all()).toEqual([1, 2, 3, 4])

      collection.unless(
        true,
        (c) => {
          if (!Array.isArray(c))
            c = []
          c.push(5)
        },
        (c) => {
          if (!Array.isArray(c))
            c = []
          c.push(6)
        },
      )

      expect(collection.all()).toEqual([1, 2, 3, 4, 6])
    })
  })

  describe('unlessEmpty() method', () => {
    it('should execute the callback when the collection is not empty', () => {
      const collection = collect([])

      collection.unlessEmpty(c => c.push('Mohamed Salah'))

      expect(collection.all()).toEqual([])
    })

    it('should execute the callback when the collection object is not empty', () => {
      const collection = collect({})

      collection.unlessEmpty(c => c.put('name', 'Mohamed Salah'))

      expect(collection.all()).toEqual({})
    })

    it('should not execute the callback when the collection is not empty', () => {
      const collection = collect(['Roberto Firmino', 'Darwin Núñez'])

      collection.unlessEmpty(c => c.push('Mohamed Salah'))

      expect(collection.all()).toEqual(['Roberto Firmino', 'Darwin Núñez', 'Mohamed Salah'])
    })

    it('should not execute the callback when the collection object is not empty', () => {
      const collection = collect({
        player1: 'Roberto Firmino',
        player2: 'Darwin Núñez',
      })

      collection.unlessEmpty(c => c.put('player3', 'Mohamed Salah'))

      expect(collection.all()).toEqual({
        player1: 'Roberto Firmino',
        player2: 'Darwin Núñez',
        player3: 'Mohamed Salah',
      })
    })

    it('should execute the default when the collection is not empty', () => {
      const collection = collect(['Darwin Núñez'])

      collection.unlessEmpty(
        c => c.push('Mohamed Salah'),
        c => c.push('Xherdan Shaqiri'),
      )

      expect(collection.all()).toEqual(['Darwin Núñez', 'Mohamed Salah'])
    })

    it('should execute the default when the collection object is not empty', () => {
      const collection = collect({})

      collection.unlessEmpty(
        c => c.put('name', 'Mohamed Salah'),
        c => c.put('name', 'Naby Keïta'),
      )

      expect(collection.all()).toEqual({
        name: 'Naby Keïta',
      })
    })
  })

  describe('unwrap() method', () => {
    it('should unwrap from collection to array', () => {
      expect(collect().unwrap(collect(['foo']))).toEqual(['foo'])
      expect(collect().unwrap(collect({ name: 'Darwin Núñez' }))).toEqual({ name: 'Darwin Núñez' })
    })

    it('should unwrap to array', () => {
      expect(collect().unwrap(['foo'])).toEqual(['foo'])
    })

    it('should unwrap to string', () => {
      expect(collect().unwrap('foo')).toEqual('foo')
    })

    it('should unwrap to an object', () => {
      expect(collect().unwrap({ name: 'Darwin Núñez' })).toEqual({ name: 'Darwin Núñez' })
    })
  })

  describe('values() method', () => {
    it('should return the object values from the collection', () => {
      const collection = collect({
        a: 'xoxo',
        b: 'abab',
        c: '1337',
        1337: 12,
      })

      const values = collection.values()

      expect(values.all()).toEqual([12, 'xoxo', 'abab', '1337'])
      expect(collection.all()).toEqual({
        a: 'xoxo',
        b: 'abab',
        c: '1337',
        1337: 12,
      })
    })

    it('should not be recursive', () => {
      const data = {
        1: {
          id: 1,
          name: 'A New Hope',
          director: {
            name: 'George Lucas',
          },
        },
        2: {
          id: 2,
          name: 'Attack of the Clones',
          director: {
            name: 'George Lucas',
          },
        },
      }

      expect(collect(data).values().all()).toEqual([
        {
          id: 1,
          name: 'A New Hope',
          director: {
            name: 'George Lucas',
          },
        },
        {
          id: 2,
          name: 'Attack of the Clones',
          director: {
            name: 'George Lucas',
          },
        },
      ])
    })
  })

  describe('when() method', () => {
    it('should execute the given callback when the first argument given to the method evaluates to true', () => {
      const collection = collect([1, 2, 3])

      collection.when(true, (c) => {
        c.push(4)
      })

      expect(collection.all()).toEqual([1, 2, 3, 4])

      collection.when(
        false,
        (c) => {
          c.push(5)
        },
        (c) => {
          c.push(6)
        },
      )

      expect(collection.all()).toEqual([1, 2, 3, 4, 6])
    })

    it('should pass the value over to the callback', () => {
      let collection = collect(['michael', 'tom'])

      collection.when('adam', (innerCollection, newName) => innerCollection.push(newName))

      expect(collection.all()).toEqual(['michael', 'tom', 'adam'])

      collection = collect(['michael', 'tom'])

      collection.when(false, (innerCollection, newName) => innerCollection.push(newName))

      expect(collection.all()).toEqual(['michael', 'tom'])
    })

    it('should call the default callback if the value is false', () => {
      const collection = collect(['michael', 'tom'])

      collection.when(
        false,
        innerCollection => innerCollection.push('adam'),
        innerCollection => innerCollection.push('taylor'),
      )

      expect(collection.all()).toEqual(['michael', 'tom', 'taylor'])
    })

    it('should return the collection object', () => {
      const collection = collect(['michael', 'tom'])

      const newCollection = collection.when('adam', innerCollection => innerCollection.push('adam'))

      expect(newCollection).toEqual(collection)
      expect(collection.all()).toEqual(['michael', 'tom', 'adam'])
    })
  })

  describe('whenEmpty() method', () => {
    it('should execute the callback when the collection is empty', () => {
      const collection = collect([])

      collection.whenEmpty(c => c.push('Mohamed Salah'))

      expect(collection.all()).toEqual(['Mohamed Salah'])
    })

    it('should execute the callback when the collection object is empty', () => {
      const collection = collect({})

      collection.whenEmpty(c => c.put('name', 'Mohamed Salah'))

      expect(collection.all()).toEqual({
        name: 'Mohamed Salah',
      })
    })

    it('should not execute the callback when the collection is empty', () => {
      const collection = collect(['Roberto Firmino', 'Darwin Núñez'])

      collection.whenEmpty(c => c.push('Mohamed Salah'))

      expect(collection.all()).toEqual(['Roberto Firmino', 'Darwin Núñez'])
    })

    it('should not execute the callback when the collection object is empty', () => {
      const collection = collect({
        player1: 'Roberto Firmino',
        player2: 'Darwin Núñez',
      })

      collection.whenEmpty(c => c.put('player3', 'Mohamed Salah'))

      expect(collection.all()).toEqual({
        player1: 'Roberto Firmino',
        player2: 'Darwin Núñez',
      })
    })

    it('should execute the default when the collection is empty', () => {
      const collection = collect(['Darwin Núñez'])

      collection.whenEmpty(
        c => c.push('Mohamed Salah'),
        c => c.push('Xherdan Shaqiri'),
      )

      expect(collection.all()).toEqual(['Darwin Núñez', 'Xherdan Shaqiri'])
    })

    it('should execute the default when the collection object is empty', () => {
      const collection = collect({
        player1: 'Xherdan Shaqiri',
      })

      collection.whenEmpty(
        c => c.put('player2', 'Mohamed Salah'),
        c => c.put('player2', 'Darwin Núñez'),
      )

      expect(collection.all()).toEqual({
        player1: 'Xherdan Shaqiri',
        player2: 'Darwin Núñez',
      })
    })
  })

  describe('whenNotEmpty() method', () => {
    it('should execute the callback when the collection is not empty', () => {
      const collection = collect([])

      collection.whenNotEmpty(c => c.push('Mohamed Salah'))

      expect(collection.all()).toEqual([])
    })

    it('should return the default value when the collection is not empty', () => {
      const collection = collect([1, 2, 3])

      collection.whenNotEmpty(c => c.push(4))

      expect(collection.all()).toEqual([1, 2, 3, 4])
    })

    it('should return the default function when the collection is not empty', () => {
      const collection = collect([])

      collection.whenNotEmpty(
        c => c.push(4),
        c => c.push(5),
      )

      expect(collection.all()).toEqual([5])
    })

    it('should execute the callback when the collection object is not empty', () => {
      const collection = collect({})

      collection.whenNotEmpty(c => c.put('name', 'Mohamed Salah'))

      expect(collection.all()).toEqual({})
    })

    it('should execute the default function when the collection object is not empty', () => {
      const collection = collect({})

      collection.whenNotEmpty(
        c => c.put('name', 'Mohamed Salah'),
        c => c.put('name', 'Darwin Núñez'),
      )

      expect(collection.all()).toEqual({
        name: 'Darwin Núñez',
      })
    })

    it('should not execute the callback when the collection is not empty', () => {
      const collection = collect(['Roberto Firmino', 'Darwin Núñez'])

      collection.whenNotEmpty(c => c.push('Mohamed Salah'))

      expect(collection.all()).toEqual(['Roberto Firmino', 'Darwin Núñez', 'Mohamed Salah'])
    })

    it('should not execute the callback when the collection object is not empty', () => {
      const collection = collect({
        player1: 'Roberto Firmino',
        player2: 'Darwin Núñez',
      })

      collection.whenNotEmpty(c => c.put('player3', 'Mohamed Salah'))

      expect(collection.all()).toEqual({
        player1: 'Roberto Firmino',
        player2: 'Darwin Núñez',
        player3: 'Mohamed Salah',
      })
    })

    it('should execute the default when the collection is not empty', () => {
      const collection = collect(['Darwin Núñez'])

      collection.whenNotEmpty(
        c => c.push('Mohamed Salah'),
        c => c.push('Xherdan Shaqiri'),
      )

      expect(collection.all()).toEqual(['Darwin Núñez', 'Mohamed Salah'])
    })

    it('should execute the default when the collection object is not empty', () => {
      const collection = collect({})

      collection.whenNotEmpty(
        c => c.put('name', 'Mohamed Salah'),
        c => c.put('name', 'Naby Keïta'),
      )

      expect(collection.all()).toEqual({
        name: 'Naby Keïta',
      })
    })
  })

  describe('where()', () => {
    const collection = collect([
      { name: 'John', age: 30 },
      { name: 'Jane', age: 20 },
      { name: 'Bob', age: 30 },
    ])

    expect(collection.where('age', 30).count()).toBe(2)
  })

  describe('whereBetween() method', () => {
    it('should filter collection within a given range', () => {
      const collection = collect([
        { product: 'Desk', price: 200 },
        { product: 'Chair', price: 80 },
        { product: 'Bookcase', price: 150 },
        { product: 'Pencil', price: 30 },
        { product: 'Door', price: 100 },
      ])

      const filtered = collection.whereBetween('price', [100, 200])

      expect(filtered.all()).toEqual([
        { product: 'Desk', price: 200 },
        { product: 'Bookcase', price: 150 },
        { product: 'Door', price: 100 },
      ])
    })

    it('should not modify the existing collection', () => {
      const collection = collect([
        { product: 'Desk', price: 200 },
        { product: 'Chair', price: 80 },
        { product: 'Bookcase', price: 150 },
        { product: 'Pencil', price: 30 },
        { product: 'Door', price: 100 },
      ])

      const filtered = collection.whereBetween('price', [100, 200])

      expect(filtered.all()).toEqual([
        { product: 'Desk', price: 200 },
        { product: 'Bookcase', price: 150 },
        { product: 'Door', price: 100 },
      ])

      expect(collection.all()).toEqual([
        { product: 'Desk', price: 200 },
        { product: 'Chair', price: 80 },
        { product: 'Bookcase', price: 150 },
        { product: 'Pencil', price: 30 },
        { product: 'Door', price: 100 },
      ])
    })
  })

  it('should work on different values', () => {
    const collection = collect([{ v: 1 }, { v: 2 }, { v: 3 }, { v: '3' }, { v: 4 }])

    expect(collection.whereBetween('v', [2, 4]).all()).toEqual([{ v: 2 }, { v: 3 }, { v: '3' }, { v: 4 }])

    expect(collection.whereBetween('v', [-1, 1]).all()).toEqual([{ v: 1 }])

    expect(collection.whereBetween('v', [3, 3]).all()).toEqual([{ v: 3 }, { v: '3' }])
  })

  describe('whereIn() method', () => {
    const products = [
      { product: 'Desk', price: 200, manufacturer: 'IKEA' },
      { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
      { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
      { product: 'Door', price: '100' },
    ]

    it('should return everything that matches within', () => {
      const collection = collect(products)
      const filtered = collection.whereIn('price', [100, 200])

      expect(filtered.all()).toEqual([
        { product: 'Desk', price: 200, manufacturer: 'IKEA' },
        { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
      ])

      expect(collection.all()).toEqual(products)

      const filtered2 = collection.whereIn('manufacturer', ['IKEA'])

      expect(filtered2.all()).toEqual([
        { product: 'Desk', price: 200, manufacturer: 'IKEA' },
        { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
      ])

      expect(collection.all()).toEqual(products)
    })

    it('should return everything that matches within given a collection', () => {
      const collection = collect(products)
      const filtered = collection.whereIn('price', collect([100, 200]))

      expect(filtered.all()).toEqual([
        { product: 'Desk', price: 200, manufacturer: 'IKEA' },
        { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
      ])

      expect(collection.all()).toEqual(products)

      const filtered2 = collection.whereIn('manufacturer', collect(['IKEA']))

      expect(filtered2.all()).toEqual([
        { product: 'Desk', price: 200, manufacturer: 'IKEA' },
        { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
      ])

      expect(collection.all()).toEqual(products)
    })

    it('should work with nested objects', () => {
      const collection2 = collect([
        { product: 'Desk', price: 200, foo: { bar: 1 } },
        { product: 'Chair', price: 100, foo: { bar: 2 } },
        { product: 'Bookcase', price: 150, foo: { bar: 2 } },
        { product: 'Door', price: 100, foo: { bar: 1 } },
      ])

      const filtered = collection2.whereIn('foo.bar', [1])

      expect(filtered.all()).toEqual([
        {
          product: 'Desk',
          price: 200,
          foo: {
            bar: 1,
          },
        },
        {
          product: 'Door',
          price: 100,
          foo: {
            bar: 1,
          },
        },
      ])

      const filtered2 = collection2.whereIn('foo.bar', [1, 2])
      expect(filtered2.all()).toEqual(collection2.all())

      const filtered3 = collection2.whereIn('foo.bar', [89])
      expect(filtered3.all()).toEqual([])
    })
  })

  describe('whereInstanceOf() method', () => {
    it('should filter collection to items that are an instance of x', () => {
      const Player = function p(name) {
        this.name = name
      }

      const Manager = function p(name) {
        this.name = name
      }

      const Firmino = new Player('Firmino')
      const Salah = new Player('Salah')
      const Klopp = new Manager('Klopp')

      const collection = collect([Firmino, Salah, Klopp])

      const filtered = collection.whereInstanceOf(Player)

      expect(filtered.all()).toEqual([Firmino, Salah])
      expect(collection.all()).toEqual([Firmino, Salah, Klopp])
    })
  })

  describe('whereNotBetween() method', () => {
    it('should filter collection within a given range', () => {
      const collection = collect([
        { product: 'Desk', price: 200 },
        { product: 'Chair', price: 80 },
        { product: 'Bookcase', price: 150 },
        { product: 'Pencil', price: 30 },
        { product: 'Door', price: 100 },
      ])

      const filtered = collection.whereNotBetween('price', [100, 200])

      expect(filtered.all()).toEqual([
        { product: 'Chair', price: 80 },
        { product: 'Pencil', price: 30 },
      ])
    })

    it('should filter out values within given scope', () => {
      const collection = collect([{ v: 1 }, { v: 2 }, { v: 3 }, { v: '3' }, { v: 4 }])

      expect(collection.whereNotBetween('v', [2, 4]).all()).toEqual([{ v: 1 }])

      expect(collection.whereNotBetween('v', [-1, 1]).all()).toEqual([{ v: 2 }, { v: 3 }, { v: '3' }, { v: 4 }])

      expect(collection.whereNotBetween('v', [3, 3]).all()).toEqual([{ v: 1 }, { v: 2 }, { v: 4 }])
    })

    it('should not modify the existing collection', () => {
      const collection = collect([{ v: 1 }, { v: 2 }, { v: 3 }, { v: '3' }, { v: 4 }])

      expect(collection.whereNotBetween('v', [2, 4]).all()).toEqual([{ v: 1 }])

      expect(collection.all()).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }, { v: '3' }, { v: 4 }])
    })
  })

  describe('whereNotIn()', () => {
    it('should filter the collection by a given key / value not contained within the given array', () => {
      const data = [
        { product: 'Desk', price: 200 },
        { product: 'Chair', price: 100 },
        { product: 'Bookcase', price: 150 },
        { product: 'Door', price: 100 },
      ]

      const collection = collect(data)

      const filtered = collection.whereNotIn('price', ['150', 200])

      expect(filtered.all()).toEqual([
        { product: 'Chair', price: 100 },
        { product: 'Bookcase', price: 150 },
        { product: 'Door', price: 100 },
      ])

      expect(collection.all()).toEqual(data)
    })

    it('should filter the collection by a given key / value not contained within the given collection', () => {
      const data = [
        { product: 'Desk', price: 200 },
        { product: 'Chair', price: 100 },
        { product: 'Bookcase', price: 150 },
        { product: 'Door', price: 100 },
      ]

      const collection = collect(data)

      const filtered = collection.whereNotIn('price', collect(['150', 200]))

      expect(filtered.all()).toEqual([
        { product: 'Chair', price: 100 },
        { product: 'Bookcase', price: 150 },
        { product: 'Door', price: 100 },
      ])

      expect(collection.all()).toEqual(data)
    })

    it('should work with nested objects', () => {
      const collection2 = collect([
        { product: 'Desk', price: 200, foo: { bar: 1 } },
        { product: 'Chair', price: 100, foo: { bar: 2 } },
        { product: 'Bookcase', price: 150, foo: { bar: 2 } },
        { product: 'Door', price: 100, foo: { bar: 1 } },
      ])

      const filtered = collection2.whereNotIn('foo.bar', [2])

      expect(filtered.all()).toEqual([
        {
          product: 'Desk',
          price: 200,
          foo: {
            bar: 1,
          },
        },
        {
          product: 'Door',
          price: 100,
          foo: {
            bar: 1,
          },
        },
      ])

      const filtered2 = collection2.whereNotIn('foo.bar', [89])
      expect(filtered2.all()).toEqual(collection2.all())
    })
  })

  describe('whereNotNull() method', () => {
    it('should remove all object where name is null', () => {
      const collection = collect([
        {
          name: 'Mohamed Salah',
        },
        {
          name: null,
        },
        {
          name: 'Darwin Núñez',
        },
      ])

      expect(collection.whereNotNull('name').all()).toEqual([
        {
          name: 'Mohamed Salah',
        },
        {
          name: 'Darwin Núñez',
        },
      ])
    })

    it('should remove all values that are null', () => {
      const collection = collect([1, 2, null, 3, 4])

      expect(collection.whereNotNull().all()).toEqual([1, 2, 3, 4])
    })
  })

  describe('whereNull() method', () => {
    it('should remove all object where name is not null', () => {
      const collection = collect([
        {
          name: 'Mohamed Salah',
        },
        {
          name: null,
        },
        {
          name: 'Darwin Núñez',
        },
      ])

      expect(collection.whereNull('name').all()).toEqual([{ name: null }])
    })

    it('should remove all values that are not null', () => {
      const collection = collect([1, 2, null, 3, 4])

      expect(collection.whereNull().all()).toEqual([null])
    })
  })

  describe('where() method', () => {
    const products = [
      { product: 'Desk', price: 200, manufacturer: 'IKEA' },
      { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
      { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
      { product: 'Door', price: '100' },
    ]

    const collection = collect(products)

    it('should filter the collection by a given key/value pair', () => {
      const filtered = collection.where('price', 100)

      expect(filtered.all()).toEqual([{ product: 'Chair', price: 100, manufacturer: 'Herman Miller' }])
      expect(collection.all()).toEqual(products)
    })

    it('should return everything that matches', () => {
      const filtered = collection.where('manufacturer', 'IKEA')

      expect(filtered.all()).toEqual([
        { product: 'Desk', price: 200, manufacturer: 'IKEA' },
        { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
      ])
      expect(collection.all()).toEqual(products)
    })

    it('should accept a custom operator: less than', () => {
      const under200 = collection.where('price', '<', 150)

      expect(under200.all()).toEqual([
        { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
        { product: 'Door', price: '100' },
      ])
    })

    it('should accept a custom operator: less than or equal to', () => {
      const overOrExactly150 = collection.where('price', '<=', 150)

      expect(overOrExactly150.all()).toEqual([
        { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
        { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
        { product: 'Door', price: '100' },
      ])
    })

    it('should accept a custom operator: bigger than', () => {
      const over150 = collection.where('price', '>', 150)

      expect(over150.all()).toEqual([{ product: 'Desk', price: 200, manufacturer: 'IKEA' }])
    })

    it('should accept a custom operator: bigger than or equal to', () => {
      const overOrExactly150 = collection.where('price', '>=', 150)

      expect(overOrExactly150.all()).toEqual([
        { product: 'Desk', price: 200, manufacturer: 'IKEA' },
        { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
      ])
    })

    it('should accept a custom operator: loosely equal', () => {
      const loosly100 = collection.where('price', '==', 100)

      expect(loosly100.all()).toEqual([
        { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
        { product: 'Door', price: '100' },
      ])
    })

    it('should accept a custom operator: strictly not equal', () => {
      const not100 = collection.where('price', '!==', 100)

      expect(not100.all()).toEqual([
        { product: 'Desk', price: 200, manufacturer: 'IKEA' },
        { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
        { product: 'Door', price: '100' },
      ])
    })

    it('should accept a custom operator: loosely not equal', () => {
      const not200 = collection.where('price', '!=', 200)

      expect(not200.all()).toEqual([
        { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
        { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
        { product: 'Door', price: '100' },
      ])

      const not100 = collection.where('price', '<>', 100)

      expect(not100.all()).toEqual([
        { product: 'Desk', price: 200, manufacturer: 'IKEA' },
        { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
      ])
    })

    it('should work when collection is an object', () => {
      const filtered = collect([{ test: 1 }, { test: 2 }])
        .keyBy('test')
        .where('test', 2)
        .all()

      expect(filtered).toEqual([{ test: 2 }])
    })

    it('should work with nested objects', () => {
      const collection2 = collect([
        { product: 'Desk', price: 200, foo: { bar: 1 } },
        { product: 'Chair', price: 100, foo: { bar: 2 } },
        { product: 'Bookcase', price: 150, foo: { bar: 2 } },
        { product: 'Door', price: 100, foo: { bar: 1 } },
      ])

      const filtered = collection2.where('foo.bar', 1)

      expect(filtered.all()).toEqual([
        {
          product: 'Desk',
          price: 200,
          foo: {
            bar: 1,
          },
        },
        {
          product: 'Door',
          price: 100,
          foo: {
            bar: 1,
          },
        },
      ])
    })

    it('should work when only passing one argument', () => {
      const hasManufacturer = collection.where('manufacturer')

      expect(hasManufacturer.all()).toEqual([
        { product: 'Desk', price: 200, manufacturer: 'IKEA' },
        { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
        { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
      ])

      const hasProduct = collection.where('product')

      expect(hasProduct.all()).toEqual([
        { product: 'Desk', price: 200, manufacturer: 'IKEA' },
        { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
        { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
        { product: 'Door', price: '100' },
      ])
    })

    it('should work when passing two argument', () => {
      const hasManufacturer = collection.where('manufacturer', true)

      expect(hasManufacturer.all()).toEqual([
        { product: 'Desk', price: 200, manufacturer: 'IKEA' },
        { product: 'Chair', price: 100, manufacturer: 'Herman Miller' },
        { product: 'Bookcase', price: 150, manufacturer: 'IKEA' },
      ])

      const dontHaveManufacturer = collection.where('manufacturer', false)

      expect(dontHaveManufacturer.all()).toEqual([{ product: 'Door', price: '100' }])
    })

    it('should work with nested properties', () => {
      const collection2 = collect([
        { name: { firstname: 'Mohamed', lastname: 'Salah' } },
        { name: { firstname: 'Darwin', lastname: 'Núñez' } },
        { name: { firstname: 'Roberto', lastname: 'Firmino' } },
      ])

      expect(collection2.where('name.lastname', 'Núñez').all()).toEqual([
        { name: { firstname: 'Darwin', lastname: 'Núñez' } },
      ])
    })
  })

  describe('wrap() method', () => {
    it('should wrap string into collection', () => {
      const collection1 = collect().wrap('foo')
      expect(collection1.all()).toEqual(['foo'])
    })

    it('should wrap array into collection', () => {
      const collection2 = collect().wrap(['foo'])
      expect(collection2.all()).toEqual(['foo'])
    })

    it('should wrap object into collection', () => {
      const collection3 = collect().wrap({})
      expect(collection3.all()).toEqual({})
    })

    it('should not re-wrap a collection', () => {
      const collection4 = collect().wrap(collect([1, 2, 3, 4]))
      expect(collection4.all()).toEqual([1, 2, 3, 4])
    })
  })

  describe('zip() method', () => {
    it('should merge together the values of two arrays', () => {
      const collection = collect(['Chair', 'Desk'])
      const zipped = collection.zip([100, 200])

      // Ensure collection2 is a valid Collection instance
      // console.log('collection2:', collection2)

      expect(zipped.all()).toEqual([collect(['Chair', 100]), collect(['Desk', 200])])

      expect(collection.all()).toEqual(['Chair', 'Desk'])
    })

    it('should be able to zip with a collection', () => {
      const collection = collect(['Chair', 'Desk'])
      const zipped = collection.zip(collect([100, 200]))

      expect(zipped.all()).toEqual([collect(['Chair', 100]), collect(['Desk', 200])])

      expect(collection.all()).toEqual(['Chair', 'Desk'])
    })
  })
})
