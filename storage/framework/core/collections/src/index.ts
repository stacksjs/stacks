import process from 'node:process'
import { clone, deleteKeys, isArray, isFunction, isObject, nestedValue, values } from './helpers/'

type IsArray<T> = T extends any[] ? true : false
type CollectionAll<T> = IsArray<T> extends true ? T : { [K in keyof T]: T[K] }

export function collect<T extends object | string | number | boolean>(items: T): Collection<T> {
  return new Collection(items)
}

export class Collection<T> {
  protected items: T[] | Record<string, T>

  constructor(items: T[] | Record<string | number | symbol, T> = []) {
    this.items = items
  }

  [Symbol.iterator] = SymbolIterator

  toJSON(): T[] {
    return this.items as T[]
  }

  all(): CollectionAll<T> {
    return this.items as CollectionAll<T>
  }

  average(key?: string | ((item: T) => number)): number {
    if (key === undefined) {
      return this.sum() / Number(this.items.length)
    }

    if (isFunction(key)) {
      return (
        Number(new (this.constructor as new (items: typeof this.items) => typeof this)(this.items).sum(key))
        / Number(this.items.length)
      )
    }

    return (
      Number(new (this.constructor as new (items: typeof this.items) => typeof this)(this.items).pluck(key).sum())
      / Number(this.items.length)
    )
  }

  avg: typeof this.average = this.average

  chunk(size: number): Collection<T[]> {
    const chunks = []
    const items = Array.isArray(this.items) ? this.items : Object.values(this.items)

    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size))
    }

    return new Collection(chunks)
  }

  collapse(): Collection<T extends any[] ? T[number] : T> {
    return new (this.constructor as any)(([] as T[]).concat(...(this.items as any[])))
  }

  combine(values: any): Collection<T> {
    if (typeof values === 'string') {
      values = [values]
    }

    if (!Array.isArray(values)) {
      throw new TypeError('The values must be an array or a string')
    }

    const collection = {}
    const keys = Array.isArray(this.items) ? this.items : Object.keys(this.items)

    keys.forEach((key, index) => {
      if (values[index] !== undefined) {
        collection[key] = values[index]
      }
    })

    return new Collection(collection)
  }

  concat(collectionOrArrayOrObject: Collection<T> | T[] | object): Collection<T> {
    let list = collectionOrArrayOrObject

    if (collectionOrArrayOrObject instanceof this.constructor) {
      list = collectionOrArrayOrObject.all()
    }
    else if (typeof collectionOrArrayOrObject === 'object') {
      list = []
      Object.keys(collectionOrArrayOrObject).forEach((property) => {
        list.push(collectionOrArrayOrObject[property])
      })
    }

    const collection = clone(this.items)

    list.forEach((item) => {
      if (typeof item === 'object') {
        Object.keys(item).forEach(key => collection.push(item[key]))
      }
      else {
        collection.push(item)
      }
    })

    return new this.constructor(collection)
  }

  contains(key: T extends (infer U)[] ? U : T | string | ((item: T, index: number) => boolean), value?: any): boolean {
    if (typeof key === 'function') {
      return this.items.some(key as (item: T, index: number) => boolean)
    }

    if (Array.isArray(this.items)) {
      return (this.items as any[]).includes(key as any)
    }

    if (value !== undefined) {
      if (Array.isArray(this.items)) {
        return this.items.some(item => item[key as keyof T] !== undefined && item[key as keyof T] === value)
      }

      return (
        (key as string | number | symbol) in this.items
        && (this.items as Record<keyof T, any>)[key as keyof T] === value
      )
    }

    if (Array.isArray(this.items)) {
      return this.items.includes(key as T extends (infer U)[] ? U : never)
    }

    return Object.values(this.items).includes(key as T extends object ? T[keyof T] : never)
  }

  containsOneItem(): boolean {
    if (typeof this.items === 'string') {
      return true
    }

    return Object.keys(this.items).length === 1
  }

  count(predicate?: (item: T) => boolean): number {
    if (predicate) {
      return this.filter(predicate).count()
    }

    return Object.keys(this.items).length
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
        }
        else {
          result = result.concat(join(collectionCopy, constructor, rest))
        }
      }

      return result
    }

    return new this.constructor(join([], this.constructor, [].concat([this.items], values)))
  }

  dd(): void {
    console.log(JSON.stringify(this.all(), null, 2))
    process.exit()
  }

  diff(values: Collection<T> | T[]): Collection<T> {
    let valuesToDiff

    if (values instanceof this.constructor) {
      valuesToDiff = values.all()
    }
    else {
      valuesToDiff = values
    }

    const collection = this.items.filter(item => !valuesToDiff.includes(item))

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
    }
    else {
      objectToDiff = object
    }

    const objectKeys = Object.keys(objectToDiff)

    const remainingKeys = Object.keys(this.items).filter(item => !objectKeys.includes(item))

    return new this.constructor(this.items).only(remainingKeys)
  }

  diffUsing(array: any[] | null, callback: (a: any, b: any) => number): Collection<T> {
    console.log('Original collection:', this.items)
    console.log('Array to compare:', array)

    if (array === null) {
      // If the input array is null, return a copy of the original collection
      return new Collection(this.items)
    }

    const collection = this.items.filter((item) => {
      const index = array.findIndex((otherItem) => {
        return callback(item, otherItem) === 0
      })

      return index === -1
    })

    return new Collection(collection)
  }

  doesntContain(key: string | number | symbol | ((item: T, index: number) => boolean), value?: any): boolean {
    console.log('doesntContain called with:', { key, value })

    if (typeof key === 'function') {
      console.log('Function branch')
      return !this.contains(key)
    }

    if (value !== undefined) {
      console.log('Key-value pair branch')
      return !this.contains((item) => {
        console.log('Comparing:', item[key], 'with', value)
        return item[key] === value
      })
    }

    console.log('Single value branch')
    return !this.contains(key)
  }

  dump(): this {
    console.log(this.items)
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

        if (!occuredValues.includes(valueAsString)) {
          occuredValues.push(valueAsString)
        }
        else {
          duplicateValues[index] = value
        }
      })
    }
    else if (typeof this.items === 'object') {
      Object.keys(this.items).forEach((key) => {
        const valueAsString = stringifiedValue(this.items[key])

        if (!occuredValues.includes(valueAsString)) {
          occuredValues.push(valueAsString)
        }
        else {
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
    }
    else {
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

  except(keys: string | string[]): Collection<T> {
    const result = { ...this.items }
    const keysArray = Array.isArray(keys) ? keys : [keys]
    keysArray.forEach(key => delete result[key])
    return new Collection(result)
  }

  filter(callback?: (item: T, index: number) => boolean): Collection<T> {
    console.log('Filter method called with callback:', callback)
    console.log('Current items:', this.items)

    if (typeof callback !== 'function') {
      console.log('No callback provided, removing falsy values')
      const filteredItems = this.items.filter((item) => {
        console.log('Filtering item:', item)
        return Boolean(item)
      })
      console.log('Filtered items:', filteredItems)
      return new Collection(filteredItems)
    }

    const filteredItems = this.items.filter((item, index) => {
      console.log('Filtering item:', item, 'at index:', index)
      return callback(item, index)
    })
    console.log('Filtered items:', filteredItems)
    return new Collection(filteredItems)
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

  firstOrFail(callback?: (item: T) => boolean): T {
    const found = this.items.find(callback || (() => true))
    if (found === undefined) {
      throw new Error('Item not found.')
    }
    return found
  }

  firstWhere(key: string, operator: string, value: any): T | null {
    return this.where(key, operator, value).first() || null
  }

  flatMap(fn: (item: T, key: string | number) => any): Collection<any> {
    return this.map(fn).collapse()
  }

  flatten(depth: number = Number.POSITIVE_INFINITY): Collection<T> {
    const flatten = (item: any, d: number): any[] => {
      if (!Array.isArray(item) && typeof item !== 'object') {
        return [item]
      }
      return d > 0
        ? Object.values(item).reduce(
          (acc, val) => acc.concat(Array.isArray(val) || typeof val === 'object' ? flatten(val, d - 1) : val),
          [],
        )
        : Array.isArray(item)
          ? [...item]
          : [item]
    }

    return new Collection(flatten(this.items, depth))
  }

  flip(): Collection<T> {
    const flipped = {}
    if (Array.isArray(this.items)) {
      this.items.forEach((value, index) => {
        flipped[value] = index
      })
    }
    else {
      Object.entries(this.items).forEach(([key, value]) => {
        flipped[value] = key
      })
    }
    return new this.constructor(flipped)
  }

  forPage(page: number, chunk: number): Collection<T> {
    let collection = {}

    if (Array.isArray(this.items)) {
      collection = this.items.slice(page * chunk - chunk, page * chunk)
    }
    else {
      Object.keys(this.items)
        .slice(page * chunk - chunk, page * chunk)
        .forEach((key) => {
          collection[key] = this.items[key]
        })
    }

    return new this.constructor(collection)
  }

  forget(key: string): Collection<T> {
    if (Array.isArray(this.items)) {
      this.items = this.items.filter((item, index) => index !== Number.parseInt(key, 10))
    }
    else if (typeof this.items === 'object' && this.items !== null) {
      delete this.items[key]
    }

    return this
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

  includes(key: T | T[keyof T]): boolean {
    if (Array.isArray(this.items)) {
      return this.items.includes(key as T)
    }

    return Object.values(this.items).includes(key)
  }

  intersect(values: Collection<T> | T[]): Collection<T> {
    let intersectValues = values

    if (values instanceof this.constructor) {
      intersectValues = values.all()
    }

    const collection = this.items.filter(item => intersectValues.includes(item))

    return new this.constructor(collection)
  }

  intersectByKeys(values: Collection<T> | T[]): Collection<T> {
    let intersectKeys = Object.keys(values)

    if (values instanceof this.constructor) {
      intersectKeys = Object.keys(values.all())
    }

    const collection = {}

    Object.keys(this.items).forEach((key) => {
      if (intersectKeys.includes(key)) {
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
    }
    else {
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
      }
      else {
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
      }
      else {
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
    }
    else {
      Object.keys(this.items).forEach((key) => {
        const [keyed, value] = fn(this.items[key], Number(key))
        collection[keyed] = value
      })
    }

    return new this.constructor(collection)
  }

  max(key?: string): number {
    if (typeof key === 'string') {
      const filtered = this.items.filter(item => item[key] !== undefined)

      return Math.max(...filtered.map(item => item[key]))
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
        }
        else if (target[key] !== undefined && source[key] === undefined) {
          merged[key] = target[key]
        }
        else if (target[key] !== undefined && source[key] !== undefined) {
          if (target[key] === source[key]) {
            merged[key] = target[key]
          }
          else if (
            !Array.isArray(target[key])
            && typeof target[key] === 'object'
            && !Array.isArray(source[key])
            && typeof source[key] === 'object'
          ) {
            merged[key] = merge(target[key], source[key])
          }
          else {
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
      const filtered = this.items.filter(item => item[key] !== undefined)

      return Math.min(...filtered.map(item => item[key]))
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
        }
        else {
          values.push({ key: item, count: 1 })
        }
      }
      else {
        tempValues[0].count += 1
        const { count } = tempValues[0]

        if (count > highestCount) {
          highestCount = count
        }
      }
    })

    return values.filter(value => value.count === highestCount).map(value => value.key)
  }

  nth(n: number, offset = 0): Collection<T> {
    const items = values(this.items)

    const collection = items.slice(offset).filter((item, index) => index % n === 0)

    return new this.constructor(collection)
  }

  only(keys: string[]): Collection<T> {
    const result = {}
    keys.forEach((key) => {
      if (key in this.items)
        result[key] = this.items[key]
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

    for (let iterator = 0; iterator < diff;) {
      if (!isArray) {
        if (items[iterator] !== undefined) {
          diff += 1
        }
        else {
          items[iterator] = value
        }
      }
      else if (prepend) {
        items.unshift(value)
      }
      else {
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
        }
        else {
          arrays[1].push(item)
        }
      })
    }
    else {
      arrays = [new this.constructor({}), new this.constructor({})]

      Object.keys(this.items).forEach((prop) => {
        const value = this.items[prop]

        if (fn(value) === true) {
          arrays[0].put(prop, value)
        }
        else {
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
    if (value.includes('*')) {
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
        }
        else {
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
      if (Number.isNaN(index))
        return defaultValue
      const value = this.items[index]
      this.items.splice(index, 1)
      return value ?? defaultValue
    }

    const value = this.items[key as string]
    delete this.items[key as string]
    return value ?? defaultValue
  }

  push(...items: T[]): Collection<T> {
    this.items = [...this.items, ...items]
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
    }
    else {
      Object.keys(this.items).forEach((key) => {
        reduceCarry = fn(reduceCarry, this.items[key], key)
      })
    }

    return reduceCarry
  }

  reject(fn) {
    return new this.constructor(this.items).filter(item => !fn(item))
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
        }
        else if (target[key] === undefined && source[key] !== undefined) {
          if (typeof target[key] === 'object') {
            replaced[key] = { ...source[key] }
          }
          else {
            replaced[key] = source[key]
          }
        }
        else if (target[key] !== undefined && source[key] === undefined) {
          if (typeof target[key] === 'object') {
            replaced[key] = { ...target[key] }
          }
          else {
            replaced[key] = target[key]
          }
        }
        else if (target[key] !== undefined && source[key] !== undefined) {
          if (typeof source[key] === 'object') {
            replaced[key] = { ...source[key] }
          }
          else {
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
    }
    else if (isObject(this.items)) {
      result = Object.keys(this.items).find(key => find(this.items[key], key))
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

    let callback = value => value === valueOrFunction
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

    let callback = value => value === valueOrFunction
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

  sole(): T {
    if (this.items.length !== 1) {
      throw new Error('Collection does not contain exactly one item.')
    }
    return this.items[0]
  }

  some(key: string): boolean {
    return this.items.some(item => item.hasOwnProperty(key))
  }

  sort(fn: (a: T, b: T) => number): Collection<T> {
    const collection = [].concat(this.items)

    if (fn === undefined) {
      if (this.every(item => typeof item === 'number')) {
        collection.sort((a, b) => a - b)
      }
      else {
        collection.sort()
      }
    }
    else {
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
    }
    else if (isFunction(key)) {
      for (let i = 0, { length } = items; i < length; i += 1) {
        total += Number.parseFloat(key(items[i]))
      }
    }
    else {
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
      }
      else {
        slicedKeys = keys.slice(0, length)
      }

      const collection = {}

      keys.forEach((prop) => {
        if (slicedKeys.includes(prop)) {
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

    let callback = value => value === valueOrFunction
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

    let callback = value => value === valueOrFunction
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
    }
    else {
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
      if (key.includes('.')) {
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
      }
      else {
        collection[key] = this.items[key]
      }
    })

    return new this.constructor(collection)
  }

  unless<T>(value: any, fn: (collection: this) => T, defaultFn?: () => T): T | undefined {
    if (!value) {
      return fn(this)
    }

    if (defaultFn)
      return defaultFn()
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

  unique(): Collection<T> {
    const uniqueItems = Array.from(new Set(this.items))
    return new this.constructor(uniqueItems)
  }

  unwrap(): T[] | Record<string, T> {
    return this.items
  }

  values(): Collection<T> {
    return new Collection(Object.values(this.items))
  }

  when(
    value: any,
    callback: (collection: Collection<T>, value: any) => void,
    defaultCallback?: () => void,
  ): Collection<T> {
    if (value) {
      callback(this, value)
    }
    else if (defaultCallback) {
      defaultCallback()
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

  where(key: string, operator?: any, value?: any): Collection<T> {
    // If only one argument is passed, we're checking for existence
    if (arguments.length === 1) {
      return new Collection(this.items.filter(item => item[key] !== undefined))
    }

    // If two arguments are passed, the second one is the value
    if (arguments.length === 2) {
      value = operator
      operator = '==='
    }

    const compareValues = (item: any, key: string, value: any, operator: string) => {
      const itemValue = item[key]

      switch (operator) {
        case '===':
          return itemValue === value
        case '!==':
          return itemValue !== value
        case '<':
          return itemValue < value
        case '<=':
          return itemValue <= value
        case '>':
          return itemValue > value
        case '>=':
          return itemValue >= value
        default:
          return itemValue == value
      }
    }

    return new Collection(this.items.filter(item => compareValues(item, key, value, operator)))
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
    const filteredItems = this.items.filter((item) => {
      const keys = key.split('.')
      let value = item

      for (const k of keys) {
        if (value[k] === undefined)
          return true
        value = value[k]
      }

      return !values.includes(value)
    })

    return new Collection(filteredItems)
  }

  private getNestedValue(item: any, key: string): any {
    const keys = key.split('.')
    return keys.reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : null), item)
  }

  whereInstanceOf(type: any): Collection<T> {
    return this.filter(item => item instanceof type)
  }

  whereNotNull(key: string): Collection<T> {
    return this.where(key, '!==', null)
  }

  whereNull(key: string): Collection<T> {
    return this.where(key, '===', null)
  }

  static wrap<T>(value: T | T[] | Collection<T>): Collection<T> {
    if (value instanceof Collection)
      return value
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

  zip(...arrays: any[]): Collection<any> {
    const arrayOfArrays = arrays.map(arg => this.constructor.wrap(arg).all())
    const zipped = this.items.map((item, index) => {
      const values = [item]
      arrayOfArrays.forEach((array) => {
        values.push(array[index])
      })
      return new this.constructor(values) // Wrap each zipped item in a new Collection
    })
    return new this.constructor(zipped)
  }
}

const buildKeyPathMap = function buildKeyPathMap(items: any) {
  const keyPaths = {}

  items.forEach((item: any, index: number) => {
    function buildKeyPath(val: any, keyPath: string) {
      if (isObject(val)) {
        Object.keys(val).forEach((prop) => {
          buildKeyPath(val[prop], `${keyPath}.${prop}`)
        })
      }
      else if (isArray(val)) {
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

export default collect
