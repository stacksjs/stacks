import { clone, deleteKeys, isArray, isFunction, isObject, nestedValue, values } from './helpers/'

export class Collection<T> {
  protected items: T[] | Record<string, T>

  constructor(items: T[] | Record<string, T> = []) {
    this.items = items
  }

  [Symbol.iterator] = SymbolIterator

  toJSON(): T[] {
    return this.items
  }

  all(): CollectionAll<T> {
    return this.items as CollectionAll<T>
  }

  average(key?: string | ((item: T) => number)): number {
    if (key === undefined) {
      return this.sum() / this.items.length
    }

    if (isFunction(key)) {
      return (
        new (this.constructor as new (items: typeof this.items) => typeof this)(this.items).sum(key) / this.items.length
      )
    }

    return (
      new (this.constructor as new (items: typeof this.items) => typeof this)(this.items).pluck(key).sum(...[]) /
      this.items.length
    )
  }

  avg: typeof this.average = this.average

  chunk(size: number): Collection<T[]> {
    const chunks = []
    for (let i = 0; i < this.items.length; i += size) {
      chunks.push(this.items.slice(i, i + size))
    }
    return new Collection(chunks)
  }

  collapse(): Collection<T extends any[] ? T[number] : T> {
    return new (this.constructor as any)(([] as T[]).concat(...(this.items as any[])))
  }

  combine<U extends unknown[]>(values: U): Collection<{ [K in T[number]]: U[number] }> {
    if (Array.isArray(this.items) && Array.isArray(values)) {
      return new Collection(Object.fromEntries(this.items.map((key, index) => [key, values[index]]))) as Collection<{
        [K in T[number]]: U[number]
      }>
    }

    throw new Error('Cannot combine non-array collections')
  }

  concat(collectionOrArrayOrObject: Collection<T> | T[] | object): Collection<T> {
    let list = collectionOrArrayOrObject

    if (collectionOrArrayOrObject instanceof this.constructor) {
      list = collectionOrArrayOrObject.all()
    } else if (typeof collectionOrArrayOrObject === 'object') {
      list = []
      Object.keys(collectionOrArrayOrObject).forEach((property) => {
        list.push(collectionOrArrayOrObject[property])
      })
    }

    const collection = clone(this.items)

    list.forEach((item) => {
      if (typeof item === 'object') {
        Object.keys(item).forEach((key) => collection.push(item[key]))
      } else {
        collection.push(item)
      }
    })

    return new this.constructor(collection)
  }

  contains(key: string | ((item: T, index: number) => boolean), value?: any): boolean {
    if (value !== undefined) {
      if (Array.isArray(this.items)) {
        return this.items.filter((items) => items[key] !== undefined && items[key] === value).length > 0
      }

      return this.items[key] !== undefined && this.items[key] === value
    }

    if (isFunction(key)) {
      return this.items.filter((item, index) => key(item, index)).length > 0
    }

    if (Array.isArray(this.items)) {
      return this.items.indexOf(key) !== -1
    }

    const keysAndValues = values(this.items)
    keysAndValues.push(...Object.keys(this.items))

    return keysAndValues.indexOf(key) !== -1
  }

  containsOneItem(): boolean {
    return this.count() === 1
  }

  count(): number {
    return Array.isArray(this.items) ? this.items.length : Object.keys(this.items).length
  }

  countBy(callback?: (item: T) => string | number): Collection<number> {
    const counts: Record<string | number, number> = {}
    this.each((item) => {
      const key = callback ? callback(item) : item
      counts[key] = (counts[key] || 0) + 1
    })
    return new Collection(counts)
  }

  crossJoin(...values: T[]): Collection<T> {
    function join(collection: T[], constructor: new (items: T[]) => Collection<T>, args: T[]): T[] {
      let current = args[0]

      if (current instanceof Collection) {
        current = current.all()
      }

      const rest = args.slice(1)
      const last = !rest.length
      let result = []

      for (let i = 0; i < current.length; i += 1) {
        const collectionCopy = collection.slice()
        collectionCopy.push(current[i])

        if (last) {
          result.push(collectionCopy)
        } else {
          result = result.concat(join(collectionCopy, constructor, rest))
        }
      }

      return result
    }

    return new this.constructor(join([], this.constructor, [].concat([this.items], values)))
  }

  dd(): void {
    this.dump()

    if (typeof process !== 'undefined') {
      process.exit(1)
    }
  }

  diff(values: Collection<T> | T[]): Collection<T> {
    let valuesToDiff

    if (values instanceof this.constructor) {
      valuesToDiff = values.all()
    } else {
      valuesToDiff = values
    }

    const collection = this.items.filter((item) => valuesToDiff.indexOf(item) === -1)

    return new this.constructor(collection)
  }

  diffAssoc(values: Collection<T> | T[]): Collection<T> {
    let diffValues = values

    if (values instanceof this.constructor) {
      diffValues = values.all()
    }

    const collection = {}

    Object.keys(this.items).forEach((key) => {
      if (diffValues[key] === undefined || diffValues[key] !== this.items[key]) {
        collection[key] = this.items[key]
      }
    })

    return new this.constructor(collection)
  }

  diffKeys(object: Collection<T> | T[]): Collection<T> {
    let objectToDiff

    if (object instanceof this.constructor) {
      objectToDiff = object.all()
    } else {
      objectToDiff = object
    }

    const objectKeys = Object.keys(objectToDiff)

    const remainingKeys = Object.keys(this.items).filter((item) => objectKeys.indexOf(item) === -1)

    return new this.constructor(this.items).only(remainingKeys)
  }

  diffUsing(values: T[], callback: (a: T, b: T) => number): Collection<T> {
    const collection = this.items.filter(
      (item) => !(values && values.some((otherItem) => callback(item, otherItem) === 0)),
    )

    return new this.constructor(collection)
  }

  doesntContain(key: string | ((item: T, index: number) => boolean), value?: any): boolean {
    return !this.contains(key, value)
  }

  dump(): Collection<T> {
    console.log(this)

    return this
  }

  duplicates(): Collection<T> {
    const occuredValues = []
    const duplicateValues = {}

    const stringifiedValue = (value: any): string => {
      if (Array.isArray(value) || typeof value === 'object') {
        return JSON.stringify(value)
      }

      return value
    }

    if (Array.isArray(this.items)) {
      this.items.forEach((value, index) => {
        const valueAsString = stringifiedValue(value)

        if (occuredValues.indexOf(valueAsString) === -1) {
          occuredValues.push(valueAsString)
        } else {
          duplicateValues[index] = value
        }
      })
    } else if (typeof this.items === 'object') {
      Object.keys(this.items).forEach((key) => {
        const valueAsString = stringifiedValue(this.items[key])

        if (occuredValues.indexOf(valueAsString) === -1) {
          occuredValues.push(valueAsString)
        } else {
          duplicateValues[key] = this.items[key]
        }
      })
    }

    return new this.constructor(duplicateValues)
  }

  each(fn: (item: T, index: number | string, items: T[]) => boolean | void): Collection<T> {
    let stop = false

    if (Array.isArray(this.items)) {
      const { length } = this.items

      for (let index = 0; index < length && !stop; index += 1) {
        stop = fn(this.items[index], index, this.items) === false
      }
    } else {
      const keys = Object.keys(this.items)
      const { length } = keys

      for (let index = 0; index < length && !stop; index += 1) {
        const key = keys[index]

        stop = fn(this.items[key], key, this.items) === false
      }
    }

    return this
  }

  eachSpread(fn: (...args: any[]) => void): Collection<T> {
    this.each((values: any, key: any) => {
      fn(...values, key)
    })

    return this
  }

  every(fn: (value: T, key: string | number, collection: T[]) => boolean): boolean {
    const items = values(this.items)

    return items.every(fn)
  }

  except(keys: string[]): Collection<T> {
    const result = { ...this.items }
    keys.forEach((key) => delete result[key])
    return new Collection(result)
  }

  filter(callback: (item: T, index: number) => boolean): Collection<T> {
    if (Array.isArray(this.items)) {
      return new Collection(this.items.filter(callback))
    }

    const filtered: Record<string, T> = {}
    Object.entries(this.items).forEach(([key, value], index) => {
      if (callback(value, index)) {
        filtered[key] = value
      }
    })

    return new Collection(filtered)
  }

  first(
    fn?: (value: T, key: string | number, collection?: T[]) => boolean,
    defaultValue?: T | (() => T),
  ): T | undefined {
    if (isFunction(fn)) {
      const keys = Object.keys(this.items)

      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        const item = this.items[key]

        if (fn(item, key)) {
          return item
        }
      }

      if (isFunction(defaultValue)) {
        return defaultValue()
      }

      return defaultValue
    }

    if ((Array.isArray(this.items) && this.items.length) || Object.keys(this.items).length) {
      if (Array.isArray(this.items)) {
        return this.items[0]
      }

      const firstKey = Object.keys(this.items)[0]

      return this.items[firstKey]
    }

    if (isFunction(defaultValue)) {
      return defaultValue()
    }

    return defaultValue
  }

  firstOrFail(key: string | ((item: T, index: number) => boolean), operator?: string, value?: any): T {
    if (isFunction(key)) {
      return this.first(key, () => {
        throw new Error('Item not found.')
      })
    }

    const collection = this.where(key, operator, value)

    if (collection.isEmpty()) {
      throw new Error('Item not found.')
    }

    return collection.first()
  }

  firstWhere(key: string, operator: string, value: any): T | null {
    return this.where(key, operator, value).first() || null
  }

  flatMap(fn: (item: T, key: string | number) => any): Collection<any> {
    return this.map(fn).collapse()
  }

  flatten(depth: number = Number.POSITIVE_INFINITY): Collection<T> {
    const flatten = (arr: any[], d: number): any[] => {
      return d > 0
        ? arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val, d - 1) : val), [])
        : arr.slice()
    }

    return new Collection(flatten(this.items as any[], depth))
  }

  flip(): Collection<T> {
    const flipped = Object.entries(this.items).reduce((acc, [key, value]) => {
      acc[value] = key
      return acc
    }, {})
    return new Collection(flipped)
  }

  forPage(page: number, chunk: number): Collection<T> {
    let collection = {}

    if (Array.isArray(this.items)) {
      collection = this.items.slice(page * chunk - chunk, page * chunk)
    } else {
      Object.keys(this.items)
        .slice(page * chunk - chunk, page * chunk)
        .forEach((key) => {
          collection[key] = this.items[key]
        })
    }

    return new this.constructor(collection)
  }

  forget(key: string): Collection<T> {
    const result = { ...this.items }
    delete result[key]
    return new Collection(result)
  }

  get(key: string | number, defaultValue: T | null = null): T | null {
    if (Array.isArray(this.items)) {
      return this.items[key as number] ?? defaultValue
    }

    return (this.items as Record<string, T>)[key as string] ?? defaultValue
  }

  groupBy(fn: ((item: T) => any) | string): Collection<Collection<T>> {
    const groups = {}
    this.each((item, key) => {
      const groupKey = typeof fn === 'function' ? fn(item) : item[fn]
      if (!(groupKey in groups)) {
        groups[groupKey] = new Collection()
      }
      groups[groupKey].push(item)
    })

    return new Collection(groups)
  }

  has(key: string | number): boolean {
    if (Array.isArray(this.items)) {
      return key in this.items
    }

    return key in (this.items as Record<string, T>)
  }

  implode(key: string, glue?: string): string {
    if (glue === undefined) {
      return this.items.join(key)
    }

    return new this.constructor(this.items).pluck(key).all().join(glue)
  }

  intersect(values: Collection<T> | T[]): Collection<T> {
    let intersectValues = values

    if (values instanceof this.constructor) {
      intersectValues = values.all()
    }

    const collection = this.items.filter((item) => intersectValues.indexOf(item) !== -1)

    return new this.constructor(collection)
  }

  intersectByKeys(values: Collection<T> | T[]): Collection<T> {
    let intersectKeys = Object.keys(values)

    if (values instanceof this.constructor) {
      intersectKeys = Object.keys(values.all())
    }

    const collection = {}

    Object.keys(this.items).forEach((key) => {
      if (intersectKeys.indexOf(key) !== -1) {
        collection[key] = this.items[key]
      }
    })

    return new this.constructor(collection)
  }

  isEmpty(): boolean {
    return this.count() === 0
  }

  isNotEmpty(): boolean {
    return !this.isEmpty()
  }

  join(glue: string, finalGlue?: string): string {
    const collection = this.values()

    if (finalGlue === undefined) {
      return collection.implode(glue)
    }

    const count = collection.count()

    if (count === 0) {
      return ''
    }

    if (count === 1) {
      return collection.last()
    }

    const finalItem = collection.pop()

    return collection.implode(glue) + finalGlue + finalItem
  }

  keyBy(key: string | ((item: T) => string)): Collection<T> {
    const collection = {}

    if (isFunction(key)) {
      this.items.forEach((item) => {
        collection[key(item)] = item
      })
    } else {
      this.items.forEach((item) => {
        const keyValue = nestedValue(item, key)

        collection[keyValue || ''] = item
      })
    }

    return new this.constructor(collection)
  }

  keys(): Collection<string> {
    return new Collection(Object.keys(this.items))
  }

  last(fn?: (item: T) => boolean, defaultValue?: T | (() => T)): T {
    let { items } = this

    if (isFunction(fn)) {
      items = this.filter(fn).all()
    }

    if ((Array.isArray(items) && !items.length) || !Object.keys(items).length) {
      if (isFunction(defaultValue)) {
        return defaultValue()
      }

      return defaultValue
    }

    if (Array.isArray(items)) {
      return items[items.length - 1]
    }
    const keys = Object.keys(items)

    return items[keys[keys.length - 1]]
  }

  macro(name: string, fn: Function): void {
    this.constructor.prototype[name] = fn
  }

  make(items: T[] = []): Collection<T> {
    return new this.constructor(items)
  }

  map(fn: (item: T, index: number) => any): Collection<any> {
    if (Array.isArray(this.items)) {
      return new this.constructor(this.items.map(fn))
    }

    const collection = {}

    Object.keys(this.items).forEach((key) => {
      collection[key] = fn(this.items[key], Number(key))
    })

    return new this.constructor(collection)
  }

  mapSpread(fn: (...args: any[]) => any): Collection<any> {
    return this.map((values, key) => fn(...values, key))
  }

  mapToDictionary(fn: (item: T, key: number) => [string, any]): Collection<any[]> {
    const collection = {}

    this.items.forEach((item, k) => {
      const [key, value] = fn(item, k)

      if (collection[key] === undefined) {
        collection[key] = [value]
      } else {
        collection[key].push(value)
      }
    })

    return new this.constructor(collection)
  }

  mapInto(ClassName: new (value: T, key: number | string) => any): Collection<any> {
    return this.map((value, key) => new ClassName(value, key))
  }

  mapToGroups(fn: (item: T, key: number) => [string, any]): Collection<any[]> {
    const collection = {}

    this.items.forEach((item, key) => {
      const [keyed, value] = fn(item, key)

      if (collection[keyed] === undefined) {
        collection[keyed] = [value]
      } else {
        collection[keyed].push(value)
      }
    })

    return new this.constructor(collection)
  }

  mapWithKeys(fn: (item: T, index: number) => [string, any]): Collection<any> {
    const collection = {}

    if (Array.isArray(this.items)) {
      this.items.forEach((item, index) => {
        const [keyed, value] = fn(item, index)
        collection[keyed] = value
      })
    } else {
      Object.keys(this.items).forEach((key) => {
        const [keyed, value] = fn(this.items[key], Number(key))
        collection[keyed] = value
      })
    }

    return new this.constructor(collection)
  }

  max(key?: string): number {
    if (typeof key === 'string') {
      const filtered = this.items.filter((item) => item[key] !== undefined)

      return Math.max(...filtered.map((item) => item[key]))
    }

    return Math.max(...this.items)
  }

  median(key?: string): number {
    const { length } = this.items

    if (key === undefined) {
      if (length % 2 === 0) {
        return (this.items[length / 2 - 1] + this.items[length / 2]) / 2
      }

      return this.items[Math.floor(length / 2)]
    }

    if (length % 2 === 0) {
      return (this.items[length / 2 - 1][key] + this.items[length / 2][key]) / 2
    }

    return this.items[Math.floor(length / 2)][key]
  }

  merge(object: object): Collection<T> {
    const merged = { ...this.items, ...object }

    return new Collection(merged)
  }

  mergeRecursive(items: T | T[] | Collection<T>): Collection<T> {
    const merge = (target: any, source: any): any => {
      const merged = {}

      const mergedKeys = Object.keys({ ...target, ...source })

      mergedKeys.forEach((key) => {
        if (target[key] === undefined && source[key] !== undefined) {
          merged[key] = source[key]
        } else if (target[key] !== undefined && source[key] === undefined) {
          merged[key] = target[key]
        } else if (target[key] !== undefined && source[key] !== undefined) {
          if (target[key] === source[key]) {
            merged[key] = target[key]
          } else if (
            !Array.isArray(target[key]) &&
            typeof target[key] === 'object' &&
            !Array.isArray(source[key]) &&
            typeof source[key] === 'object'
          ) {
            merged[key] = merge(target[key], source[key])
          } else {
            merged[key] = [].concat(target[key], source[key])
          }
        }
      })

      return merged
    }

    if (!items) {
      return this
    }

    if (items.constructor.name === 'Collection') {
      return new this.constructor(merge(this.items, items.all()))
    }

    return new this.constructor(merge(this.items, items))
  }

  min(key?: string): number {
    if (key !== undefined) {
      const filtered = this.items.filter((item) => item[key] !== undefined)

      return Math.min(...filtered.map((item) => item[key]))
    }

    return Math.min(...this.items)
  }

  mode(key?: string): any[] {
    const values = []
    let highestCount = 1

    if (!this.items.length) {
      return null
    }

    this.items.forEach((item) => {
      const tempValues = values.filter((value) => {
        if (key !== undefined) {
          return value.key === item[key]
        }

        return value.key === item
      })

      if (!tempValues.length) {
        if (key !== undefined) {
          values.push({ key: item[key], count: 1 })
        } else {
          values.push({ key: item, count: 1 })
        }
      } else {
        tempValues[0].count += 1
        const { count } = tempValues[0]

        if (count > highestCount) {
          highestCount = count
        }
      }
    })

    return values.filter((value) => value.count === highestCount).map((value) => value.key)
  }

  nth(n: number, offset = 0): Collection<T> {
    const items = values(this.items)

    const collection = items.slice(offset).filter((item, index) => index % n === 0)

    return new this.constructor(collection)
  }

  only(keys: string[]): Collection<T> {
    const result = {}
    keys.forEach((key) => {
      if (key in this.items) result[key] = this.items[key]
    })
    return new Collection(result)
  }

  pad(size: number, value: T): Collection<T> {
    const abs = Math.abs(size)
    const count = this.count()

    if (abs <= count) {
      return this
    }

    let diff = abs - count
    const items = clone(this.items)
    const isArray = Array.isArray(this.items)
    const prepend = size < 0

    for (let iterator = 0; iterator < diff; ) {
      if (!isArray) {
        if (items[iterator] !== undefined) {
          diff += 1
        } else {
          items[iterator] = value
        }
      } else if (prepend) {
        items.unshift(value)
      } else {
        items.push(value)
      }

      iterator += 1
    }

    return new this.constructor(items)
  }

  partition(fn: (item: T) => boolean): [Collection<T>, Collection<T>] {
    let arrays

    if (Array.isArray(this.items)) {
      arrays = [new this.constructor([]), new this.constructor([])]

      this.items.forEach((item) => {
        if (fn(item) === true) {
          arrays[0].push(item)
        } else {
          arrays[1].push(item)
        }
      })
    } else {
      arrays = [new this.constructor({}), new this.constructor({})]

      Object.keys(this.items).forEach((prop) => {
        const value = this.items[prop]

        if (fn(value) === true) {
          arrays[0].put(prop, value)
        } else {
          arrays[1].put(prop, value)
        }
      })
    }

    return new this.constructor(arrays)
  }

  pipe(fn) {
    return fn(this)
  }

  pluck(value: string, key?: string) {
    if (value.indexOf('*') !== -1) {
      const keyPathMap = buildKeyPathMap(this.items)
      const keyMatches = []

      if (key !== undefined) {
        const keyRegex = new RegExp(`0.${key}`, 'g')
        const keyNumberOfLevels = `0.${key}`.split('.').length

        Object.keys(keyPathMap).forEach((k) => {
          const matchingKey = k.match(keyRegex)

          if (matchingKey) {
            const match = matchingKey[0]

            if (match.split('.').length === keyNumberOfLevels) {
              keyMatches.push(keyPathMap[match])
            }
          }
        })
      }

      const valueMatches = []
      const valueRegex = new RegExp(`0.${value}`, 'g')
      const valueNumberOfLevels = `0.${value}`.split('.').length

      Object.keys(keyPathMap).forEach((k) => {
        const matchingValue = k.match(valueRegex)

        if (matchingValue) {
          const match = matchingValue[0]

          if (match.split('.').length === valueNumberOfLevels) {
            valueMatches.push(keyPathMap[match])
          }
        }
      })

      if (key !== undefined) {
        const collection = {}

        this.items.forEach((item, index) => {
          collection[keyMatches[index] || ''] = valueMatches
        })

        return new this.constructor(collection)
      }

      return new this.constructor([valueMatches])
    }

    if (key !== undefined) {
      const collection = {}

      this.items.forEach((item) => {
        if (nestedValue(item, value) !== undefined) {
          collection[item[key] || ''] = nestedValue(item, value)
        } else {
          collection[item[key] || ''] = null
        }
      })

      return new this.constructor(collection)
    }

    return this.map((item) => {
      if (nestedValue(item, value) !== undefined) {
        return nestedValue(item, value)
      }

      return null
    })
  }

  pop(count = 1) {
    if (this.isEmpty()) {
      return null
    }

    if (isArray(this.items)) {
      if (count === 1) {
        return this.items.pop()
      }

      return new this.constructor(this.items.splice(-count))
    }

    if (isObject(this.items)) {
      const keys = Object.keys(this.items)

      if (count === 1) {
        const key = keys[keys.length - 1]
        const last = this.items[key]

        deleteKeys(this.items, key)

        return last
      }

      const poppedKeys = keys.slice(-count)

      const newObject = poppedKeys.reduce((acc, current) => {
        acc[current] = this.items[current]

        return acc
      }, {})

      deleteKeys(this.items, poppedKeys)

      return new this.constructor(newObject)
    }

    return null
  }

  prepend(value, key) {
    if (key !== undefined) {
      return this.put(key, value)
    }

    this.items.unshift(value)

    return this
  }

  pull(key: string | number, defaultValue: T | null = null): T | null {
    if (Array.isArray(this.items)) {
      const index = Number(key)
      if (Number.isNaN(index)) return defaultValue
      const value = this.items[index]
      this.items.splice(index, 1)
      return value ?? defaultValue
    }

    const value = this.items[key as string]
    delete this.items[key as string]
    return value ?? defaultValue
  }

  push(...items) {
    this.items.push(...items)

    return this
  }

  put(key: string, value: any): this {
    this.items[key] = value
    return this
  }

  random(length = null) {
    const items = values(this.items)

    const collection = new this.constructor(items).shuffle()

    // If not a length was specified
    if (length !== Number.parseInt(length, 10)) {
      return collection.first()
    }

    return collection.take(length)
  }

  reduce(fn, carry) {
    let reduceCarry = null

    if (carry !== undefined) {
      reduceCarry = carry
    }

    if (Array.isArray(this.items)) {
      this.items.forEach((item) => {
        reduceCarry = fn(reduceCarry, item)
      })
    } else {
      Object.keys(this.items).forEach((key) => {
        reduceCarry = fn(reduceCarry, this.items[key], key)
      })
    }

    return reduceCarry
  }

  reject(fn) {
    return new this.constructor(this.items).filter((item) => !fn(item))
  }

  replace(items) {
    if (!items) {
      return this
    }

    if (Array.isArray(items)) {
      const replaced = this.items.map((value, index) => items[index] || value)

      return new this.constructor(replaced)
    }

    if (items.constructor.name === 'Collection') {
      const replaced = { ...this.items, ...items.all() }

      return new this.constructor(replaced)
    }

    const replaced = { ...this.items, ...items }

    return new this.constructor(replaced)
  }

  replaceRecursive(items) {
    const replace = (target, source) => {
      const replaced = { ...target }

      const mergedKeys = Object.keys({ ...target, ...source })

      mergedKeys.forEach((key) => {
        if (!Array.isArray(source[key]) && typeof source[key] === 'object') {
          replaced[key] = replace(target[key], source[key])
        } else if (target[key] === undefined && source[key] !== undefined) {
          if (typeof target[key] === 'object') {
            replaced[key] = { ...source[key] }
          } else {
            replaced[key] = source[key]
          }
        } else if (target[key] !== undefined && source[key] === undefined) {
          if (typeof target[key] === 'object') {
            replaced[key] = { ...target[key] }
          } else {
            replaced[key] = target[key]
          }
        } else if (target[key] !== undefined && source[key] !== undefined) {
          if (typeof source[key] === 'object') {
            replaced[key] = { ...source[key] }
          } else {
            replaced[key] = source[key]
          }
        }
      })

      return replaced
    }

    if (!items) {
      return this
    }

    if (!Array.isArray(items) && typeof items !== 'object') {
      return new this.constructor(replace(this.items, [items]))
    }

    if (items.constructor.name === 'Collection') {
      return new this.constructor(replace(this.items, items.all()))
    }

    return new this.constructor(replace(this.items, items))
  }

  reverse() {
    const collection = [].concat(this.items).reverse()

    return new this.constructor(collection)
  }

  search(valueOrFunction, strict) {
    let result

    const find = (item, key) => {
      if (isFunction(valueOrFunction)) {
        return valueOrFunction(this.items[key], key)
      }

      if (strict) {
        return this.items[key] === valueOrFunction
      }

      return this.items[key] == valueOrFunction
    }

    if (isArray(this.items)) {
      result = this.items.findIndex(find)
    } else if (isObject(this.items)) {
      result = Object.keys(this.items).find((key) => find(this.items[key], key))
    }

    if (result === undefined || result < 0) {
      return false
    }

    return result
  }

  shift(count = 1): T | undefined | null {
    if (this.isEmpty()) {
      return null
    }

    if (isArray(this.items)) {
      if (count === 1) {
        return this.items.shift()
      }

      return new this.constructor(this.items.splice(0, count))
    }

    if (isObject(this.items)) {
      if (count === 1) {
        const key = Object.keys(this.items)[0]
        const value = this.items[key]
        delete this.items[key]

        return value
      }

      const keys = Object.keys(this.items)
      const poppedKeys = keys.slice(0, count)

      const newObject = poppedKeys.reduce((acc, current) => {
        acc[current] = this.items[current]

        return acc
      }, {})

      deleteKeys(this.items, poppedKeys)

      return new this.constructor(newObject)
    }

    return null
  }

  shuffle(): Collection<T> {
    const items = values(this.items)

    let j
    let x
    let i

    for (i = items.length; i; i -= 1) {
      j = Math.floor(Math.random() * i)
      x = items[i - 1]
      items[i - 1] = items[j]
      items[j] = x
    }

    this.items = items

    return this
  }

  skip(number: number): Collection<T> {
    if (isObject(this.items)) {
      return new this.constructor(
        Object.keys(this.items).reduce((accumulator, key, index) => {
          if (index + 1 > number) {
            accumulator[key] = this.items[key]
          }

          return accumulator
        }, {}),
      )
    }

    return new this.constructor(this.items.slice(number))
  }

  skipUntil(valueOrFunction: any): Collection<T> {
    let previous = null
    let items

    let callback = (value) => value === valueOrFunction
    if (isFunction(valueOrFunction)) {
      callback = valueOrFunction
    }

    if (isArray(this.items)) {
      items = this.items.filter((item) => {
        if (previous !== true) {
          previous = callback(item)
        }

        return previous
      })
    }

    if (isObject(this.items)) {
      items = Object.keys(this.items).reduce((acc, key) => {
        if (previous !== true) {
          previous = callback(this.items[key])
        }

        if (previous !== false) {
          acc[key] = this.items[key]
        }

        return acc
      }, {})
    }

    return new this.constructor(items)
  }

  skipWhile(valueOrFunction: any): Collection<T> {
    let previous = null
    let items

    let callback = (value) => value === valueOrFunction
    if (isFunction(valueOrFunction)) {
      callback = valueOrFunction
    }

    if (isArray(this.items)) {
      items = this.items.filter((item) => {
        if (previous !== true) {
          previous = !callback(item)
        }

        return previous
      })
    }

    if (isObject(this.items)) {
      items = Object.keys(this.items).reduce((acc, key) => {
        if (previous !== true) {
          previous = !callback(this.items[key])
        }

        if (previous !== false) {
          acc[key] = this.items[key]
        }

        return acc
      }, {})
    }

    return new this.constructor(items)
  }

  slice(remove: number, limit: number): Collection<T> {
    let collection = this.items.slice(remove)

    if (limit !== undefined) {
      collection = collection.slice(0, limit)
    }

    return new this.constructor(collection)
  }

  sole(key: string, operator: string, value: any): T | undefined {
    let collection

    if (isFunction(key)) {
      collection = this.filter(key)
    } else {
      collection = this.where(key, operator, value)
    }

    if (collection.isEmpty()) {
      throw new Error('Item not found.')
    }

    if (collection.count() > 1) {
      throw new Error('Multiple items found.')
    }

    return collection.first()
  }

  some: typeof this.contains = this.contains

  sort(fn: (a: T, b: T) => number): Collection<T> {
    const collection = [].concat(this.items)

    if (fn === undefined) {
      if (this.every((item) => typeof item === 'number')) {
        collection.sort((a, b) => a - b)
      } else {
        collection.sort()
      }
    } else {
      collection.sort(fn)
    }

    return new this.constructor(collection)
  }

  sortDesc(): Collection<T> {
    return this.sort().reverse()
  }

  sortBy(valueOrFunction: any): Collection<T> {
    const collection = [].concat(this.items)
    const getValue = (item) => {
      if (isFunction(valueOrFunction)) {
        return valueOrFunction(item)
      }

      return nestedValue(item, valueOrFunction)
    }

    collection.sort((a, b) => {
      const valueA = getValue(a)
      const valueB = getValue(b)

      if (valueA === null || valueA === undefined) {
        return 1
      }
      if (valueB === null || valueB === undefined) {
        return -1
      }

      if (valueA < valueB) {
        return -1
      }
      if (valueA > valueB) {
        return 1
      }

      return 0
    })

    return new this.constructor(collection)
  }

  sortByDesc(valueOrFunction: any): Collection<T> {
    return this.sortBy(valueOrFunction).reverse()
  }

  sortKeys(): Collection<T> {
    const ordered = {}

    Object.keys(this.items)
      .sort()
      .forEach((key) => {
        ordered[key] = this.items[key]
      })

    return new this.constructor(ordered)
  }

  sortKeysDesc(): Collection<T> {
    const ordered = {}

    Object.keys(this.items)
      .sort()
      .reverse()
      .forEach((key) => {
        ordered[key] = this.items[key]
      })

    return new this.constructor(ordered)
  }

  splice(index: number, limit: number, replace: any): Collection<T> {
    const slicedCollection = this.slice(index, limit)

    this.items = this.diff(slicedCollection.all()).all()

    if (Array.isArray(replace)) {
      for (let iterator = 0, { length } = replace; iterator < length; iterator += 1) {
        this.items.splice(index + iterator, 0, replace[iterator])
      }
    }

    return slicedCollection
  }

  split(numberOfGroups: number): Collection<T[]> {
    const itemsArray = this.toArray()
    const groups: T[][] = []
    const size = Math.ceil(itemsArray.length / numberOfGroups)

    for (let i = 0; i < itemsArray.length; i += size) {
      groups.push(itemsArray.slice(i, i + size))
    }

    return new Collection(groups)
  }

  sum(key?: string | ((item: T) => number)): number {
    const items = values(this.items)

    let total = 0

    if (key === undefined) {
      for (let i = 0, { length } = items; i < length; i += 1) {
        total += Number.parseFloat(items[i])
      }
    } else if (isFunction(key)) {
      for (let i = 0, { length } = items; i < length; i += 1) {
        total += Number.parseFloat(key(items[i]))
      }
    } else {
      for (let i = 0, { length } = items; i < length; i += 1) {
        total += Number.parseFloat(items[i][key])
      }
    }

    return Number.parseFloat(total.toPrecision(12))
  }

  take(length: number): Collection<T> {
    if (!Array.isArray(this.items) && typeof this.items === 'object') {
      const keys = Object.keys(this.items)
      let slicedKeys

      if (length < 0) {
        slicedKeys = keys.slice(length)
      } else {
        slicedKeys = keys.slice(0, length)
      }

      const collection = {}

      keys.forEach((prop) => {
        if (slicedKeys.indexOf(prop) !== -1) {
          collection[prop] = this.items[prop]
        }
      })

      return new this.constructor(collection)
    }

    if (length < 0) {
      return new this.constructor(this.items.slice(length))
    }

    return new this.constructor(this.items.slice(0, length))
  }

  takeUntil(valueOrFunction): Collection<T> {
    let previous = null
    let items

    let callback = (value) => value === valueOrFunction
    if (isFunction(valueOrFunction)) {
      callback = valueOrFunction
    }

    if (isArray(this.items)) {
      items = this.items.filter((item) => {
        if (previous !== false) {
          previous = !callback(item)
        }

        return previous
      })
    }

    if (isObject(this.items)) {
      items = Object.keys(this.items).reduce((acc, key) => {
        if (previous !== false) {
          previous = !callback(this.items[key])
        }

        if (previous !== false) {
          acc[key] = this.items[key]
        }

        return acc
      }, {})
    }

    return new this.constructor(items)
  }

  takeWhile(valueOrFunction: any): Collection<T> {
    let previous = null
    let items

    let callback = (value) => value === valueOrFunction
    if (isFunction(valueOrFunction)) {
      callback = valueOrFunction
    }

    if (isArray(this.items)) {
      items = this.items.filter((item) => {
        if (previous !== false) {
          previous = callback(item)
        }

        return previous
      })
    }

    if (isObject(this.items)) {
      items = Object.keys(this.items).reduce((acc, key) => {
        if (previous !== false) {
          previous = callback(this.items[key])
        }

        if (previous !== false) {
          acc[key] = this.items[key]
        }

        return acc
      }, {})
    }

    return new this.constructor(items)
  }

  tap(fn: (collection: Collection<T>) => void): Collection<T> {
    fn(this)

    return this
  }

  times(n: number, fn: (iterator: number) => void): Collection<T> {
    for (let iterator = 1; iterator <= n; iterator += 1) {
      this.items.push(fn(iterator))
    }

    return this
  }

  toArray(): T[] {
    return Array.isArray(this.items) ? this.items : Object.values(this.items)
  }

  toJson(): string {
    return JSON.stringify(this.items)
  }

  transform(fn: (item: T, key: string) => T): Collection<T> {
    if (Array.isArray(this.items)) {
      this.items = this.items.map(fn)
    } else {
      const collection = {}

      Object.keys(this.items).forEach((key) => {
        collection[key] = fn(this.items[key], key)
      })

      this.items = collection
    }

    return this
  }

  undot(): Collection<T> {
    if (Array.isArray(this.items)) {
      return this
    }

    let collection = {}

    Object.keys(this.items).forEach((key) => {
      if (key.indexOf('.') !== -1) {
        const obj = collection

        key.split('.').reduce((acc, current, index, array) => {
          if (!acc[current]) {
            acc[current] = {}
          }

          if (index === array.length - 1) {
            acc[current] = this.items[key]
          }

          return acc[current]
        }, obj)

        collection = { ...collection, ...obj }
      } else {
        collection[key] = this.items[key]
      }
    })

    return new this.constructor(collection)
  }

  unless<T>(value: any, fn: (collection: this) => T, defaultFn?: () => T): T | undefined {
    if (!value) {
      return fn(this)
    }

    if (defaultFn) return defaultFn()
    return undefined
  }

  unlessEmpty(callback: (collection: Collection<T>) => void): this {
    if (!this.isEmpty()) {
      callback(this)
    }

    return this
  }

  unlessNotEmpty(callback: (collection: Collection<T>) => void): Collection<T> {
    if (this.isEmpty()) {
      callback(this)
    }

    return this
  }

  union(object: Record<string, T>): Collection<T> {
    const collection = JSON.parse(JSON.stringify(this.items))

    Object.keys(object).forEach((prop) => {
      if (this.items[prop] === undefined) {
        collection[prop] = object[prop]
      }
    })

    return new this.constructor(collection)
  }

  unique(key: string | ((item: T) => string)): Collection<T> {
    let collection

    if (key === undefined) {
      collection = this.items.filter((element, index, self) => self.indexOf(element) === index)
    } else {
      collection = []

      const usedKeys = []

      for (let iterator = 0, { length } = this.items; iterator < length; iterator += 1) {
        let uniqueKey
        if (isFunction(key)) {
          uniqueKey = key(this.items[iterator])
        } else {
          uniqueKey = this.items[iterator][key]
        }

        if (usedKeys.indexOf(uniqueKey) === -1) {
          collection.push(this.items[iterator])
          usedKeys.push(uniqueKey)
        }
      }
    }

    return new this.constructor(collection)
  }

  unwrap(): T[] | Record<string, T> {
    return this.items
  }

  values(): Collection<T> {
    return new Collection(Object.values(this.items))
  }

  when(
    value: boolean,
    fn: (collection: Collection<T>) => void,
    defaultFn: (collection: Collection<T>) => void = () => {},
  ): Collection<T> {
    if (value) {
      fn(this)
    } else {
      defaultFn(this)
    }
    return this
  }

  whenEmpty(fn, defaultFn) {
    if (Array.isArray(this.items) && !this.items.length) {
      return fn(this)
    }
    if (!Object.keys(this.items).length) {
      return fn(this)
    }

    if (defaultFn !== undefined) {
      if (Array.isArray(this.items) && this.items.length) {
        return defaultFn(this)
      }
      if (Object.keys(this.items).length) {
        return defaultFn(this)
      }
    }

    return this
  }

  whenNotEmpty(fn: (collection: Collection<T>) => void, defaultFn: (collection: Collection<T>) => void): Collection<T> {
    if (Array.isArray(this.items) && this.items.length) {
      return fn(this)
    }

    if (Object.keys(this.items).length) {
      return fn(this)
    }

    if (defaultFn !== undefined) {
      if (Array.isArray(this.items) && !this.items.length) {
        return defaultFn(this)
      }
      if (!Object.keys(this.items).length) {
        return defaultFn(this)
      }
    }

    return this
  }

  where(key: string, operator: string, value: any): Collection<T> {
    let comparisonOperator = operator
    let comparisonValue = value

    const items = values(this.items)

    if (operator === undefined || operator === true) {
      return new this.constructor(items.filter((item) => nestedValue(item, key)))
    }

    if (operator === false) {
      return new this.constructor(items.filter((item) => !nestedValue(item, key)))
    }

    if (value === undefined) {
      comparisonValue = operator
      comparisonOperator = '==='
    }

    const collection = items.filter((item) => {
      switch (comparisonOperator) {
        case '==':
          return (
            nestedValue(item, key) === Number(comparisonValue) || nestedValue(item, key) === comparisonValue.toString()
          )

        case '!=':
        case '<>':
          return (
            nestedValue(item, key) !== Number(comparisonValue) && nestedValue(item, key) !== comparisonValue.toString()
          )

        case '!==':
          return nestedValue(item, key) !== comparisonValue

        case '<':
          return nestedValue(item, key) < comparisonValue

        case '<=':
          return nestedValue(item, key) <= comparisonValue

        case '>':
          return nestedValue(item, key) > comparisonValue

        case '>=':
          return nestedValue(item, key) >= comparisonValue

        case '===':
          return nestedValue(item, key) === comparisonValue

        default:
          return nestedValue(item, key) === comparisonValue
      }
    })

    return new this.constructor(collection)
  }

  whereBetween(key: string, values: [number, number]): Collection<T> {
    return this.filter((item) => {
      const itemValue = typeof item === 'object' ? item[key] : item
      return itemValue >= values[0] && itemValue <= values[1]
    })
  }

  whereIn(key: string, values: any[]): Collection<T> {
    return this.filter((item) => {
      const itemValue = typeof item === 'object' ? item[key] : item
      return values.includes(itemValue)
    })
  }

  whereNotBetween(key: string, values: [number, number]): Collection<T> {
    return this.filter((item) => {
      const itemValue = typeof item === 'object' ? item[key] : item
      return itemValue < values[0] || itemValue > values[1]
    })
  }

  whereNotIn(key: string, values: any[]): Collection<T> {
    return this.filter((item) => {
      const itemValue = typeof item === 'object' ? item[key] : item
      return !values.includes(itemValue)
    })
  }

  private getNestedValue(item: any, key: string): any {
    const keys = key.split('.')
    return keys.reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : null), item)
  }

  whereInstanceOf(type: any): Collection<T> {
    return this.filter((item) => item instanceof type)
  }

  whereNotNull(key: string): Collection<T> {
    return this.where(key, '!==', null)
  }

  whereNull(key: string): Collection<T> {
    return this.where(key, '===', null)
  }

  static wrap<T>(value: T | T[] | Collection<T>): Collection<T> {
    if (value instanceof Collection) return value
    return new Collection(Array.isArray(value) ? value : [value])
  }

  static unwrap<T extends object>(value: T | T[] | Collection<T>): T | T[] {
    if (value instanceof Collection) {
      return value.all()
    }

    return value
  }

  wrap(value: any): Collection<T> {
    if (value instanceof Collection) {
      return value
    }

    if (typeof value === 'object') {
      return new Collection(value)
    }

    return new Collection([value])
  }

  zip(array: any[]): Collection<[T, any]> {
    return new Collection((this.items as T[]).map((item, index): [T, any] => [item, array[index]]))
  }
}

function falsyValue(item: any) {
  if (Array.isArray(item)) {
    if (item.length) {
      return false
    }
  } else if (item !== undefined && item !== null && typeof item === 'object') {
    if (Object.keys(item).length) {
      return false
    }
  } else if (item) {
    return false
  }

  return true
}

function filterObject(func: (item: any, key: string) => boolean, items: Record<string, any>) {
  const result = {}
  Object.keys(items).forEach((key) => {
    if (func) {
      if (func(items[key], key)) {
        result[key] = items[key]
      }
    } else if (!falsyValue(items[key])) {
      result[key] = items[key]
    }
  })

  return result
}

const buildKeyPathMap = function buildKeyPathMap(items: any) {
  const keyPaths = {}

  items.forEach((item: any, index: number) => {
    function buildKeyPath(val: any, keyPath: string) {
      if (isObject(val)) {
        Object.keys(val).forEach((prop) => {
          buildKeyPath(val[prop], `${keyPath}.${prop}`)
        })
      } else if (isArray(val)) {
        val.forEach((v, i) => {
          buildKeyPath(v, `${keyPath}.${i}`)
        })
      }

      keyPaths[keyPath] = val
    }

    buildKeyPath(item, index)
  })

  return keyPaths
}

function SymbolIterator() {
  let index = -1

  return {
    next: () => {
      index += 1

      return {
        value: this.items[index],
        done: index >= this.items.length,
      }
    },
  }
}

export function collect<T extends object | any[]>(items: T): Collection<T> {
  return new Collection(items)
}

type IsArray<T> = T extends any[] ? true : false
type CollectionAll<T> = IsArray<T> extends true ? T : { [K in keyof T]: T[K] }

export default collect
