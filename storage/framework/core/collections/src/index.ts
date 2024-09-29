import { clone, is, nestedValue, values } from './helpers/'

export class Collection<T extends object> {
  private items: T[]

  constructor(collection?: T | T[] | Collection<T>) {
    if (collection !== undefined && !Array.isArray(collection) && typeof collection === 'object') {
      this.items = [collection as T]
    } else if (collection instanceof Collection) {
      this.items = collection.all()
    } else {
      this.items = (collection as T[]) || []
    }
  }

  [Symbol.iterator] = SymbolIterator

  toJSON(): T[] {
    return this.items
  }

  all(): T[] {
    return this.items
  }

  average(key: string | ((item: T) => number)): number {
    if (key === undefined) {
      return this.sum() / this.items.length
    }

    if (is.isFunction(key)) {
      return (
        new (this.constructor as new (items: typeof this.items) => typeof this)(this.items).sum(key) / this.items.length
      )
    }

    return (
      new (this.constructor as new (items: typeof this.items) => typeof this)(this.items).pluck(key).sum() /
      this.items.length
    )
  }

  avg: typeof this.average = this.average

  chunk(size: number): Collection<T[]> {
    const chunks = []
    let index = 0

    if (Array.isArray(this.items)) {
      do {
        const items = this.items.slice(index, index + size)
        const collection = new this.constructor(items)

        chunks.push(collection)
        index += size
      } while (index < this.items.length)
    } else if (typeof this.items === 'object') {
      const keys = Object.keys(this.items)

      do {
        const keysOfChunk = keys.slice(index, index + size)
        const collection = new this.constructor({})

        keysOfChunk.forEach((key) => collection.put(key, this.items[key]))

        chunks.push(collection)
        index += size
      } while (index < keys.length)
    } else {
      chunks.push(new this.constructor([this.items]))
    }

    return new this.constructor(chunks)
  }

  collapse(): Collection<T> {
    return new this.constructor([].concat(...this.items))
  }

  combine(array: Collection<T> | T[]): Collection<T> {
    let values = array

    if (values instanceof this.constructor) {
      values = array.all()
    }

    const collection = {}

    if (Array.isArray(this.items) && Array.isArray(values)) {
      this.items.forEach((key, iterator) => {
        collection[key] = values[iterator]
      })
    } else if (typeof this.items === 'object' && typeof values === 'object') {
      Object.keys(this.items).forEach((key, index) => {
        collection[this.items[key]] = values[Object.keys(values)[index]]
      })
    } else if (Array.isArray(this.items)) {
      collection[this.items[0]] = values
    } else if (typeof this.items === 'string' && Array.isArray(values)) {
      ;[collection[this.items]] = values
    } else if (typeof this.items === 'string') {
      collection[this.items] = values
    }

    return new this.constructor(collection)
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

  contains(key: string, value: any): boolean {
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
    let arrayLength = 0

    if (Array.isArray(this.items)) {
      arrayLength = this.items.length
    }

    return Math.max(Object.keys(this.items).length, arrayLength)
  }

  countBy(fn: Function = (value: T) => value): number {
    return new this.constructor(this.items).groupBy(fn).map((value: T) => value.count())
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

  diffAssoc: typeof diffAssoc = diffAssoc
  diffKeys: typeof diffKeys = diffKeys
  diffUsing: typeof diffUsing = diffUsing
  doesntContain: typeof doesntContain = doesntContain
  dump: typeof dump = dump
  duplicates: typeof duplicates = duplicates
  each: typeof each = each
  eachSpread: typeof eachSpread = eachSpread
  every: typeof every = every
  except: typeof except = except
  filter: typeof filter = filter
  first: typeof first = first
  firstOrFail: typeof firstOrFail = firstOrFail
  firstWhere: typeof firstWhere = firstWhere
  flatMap: typeof flatMap = flatMap
  flatten: typeof flatten = flatten
  flip: typeof flip = flip
  forPage: typeof forPage = forPage
  forget: typeof forget = forget
  get: typeof get = get
  groupBy: typeof groupBy = groupBy
  has: typeof has = has
  implode: typeof implode = implode
  intersect: typeof intersect = intersect
  intersectByKeys: typeof intersectByKeys = intersectByKeys
  isEmpty: typeof isEmpty = isEmpty
  isNotEmpty: typeof isNotEmpty = isNotEmpty
  join: typeof join = join
  keyBy: typeof keyBy = keyBy
  keys: typeof keys = keys
  last: typeof last = last
  macro: typeof macro = macro
  make: typeof make = make
  map: typeof map = map
  mapSpread: typeof mapSpread = mapSpread
  mapToDictionary: typeof mapToDictionary = mapToDictionary
  mapInto: typeof mapInto = mapInto
  mapToGroups: typeof mapToGroups = mapToGroups
  mapWithKeys: typeof mapWithKeys = mapWithKeys
  max: typeof max = max
  median: typeof median = median
  merge: typeof merge = merge
  mergeRecursive: typeof mergeRecursive = mergeRecursive
  min: typeof min = min
  mode: typeof mode = mode
  nth: typeof nth = nth
  only: typeof only = only
  pad: typeof pad = pad
  partition: typeof partition = partition
  pipe: typeof pipe = pipe
  pluck: typeof pluck = pluck
  pop: typeof pop = pop
  prepend: typeof prepend = prepend
  pull: typeof pull = pull
  push: typeof push = push
  put: typeof put = put
  random: typeof random = random
  reduce: typeof reduce = reduce
  reject: typeof reject = reject
  replace: typeof replace = replace
  replaceRecursive: typeof replaceRecursive = replaceRecursive
  reverse: typeof reverse = reverse
  search: typeof search = search
  shift: typeof shift = shift
  shuffle: typeof shuffle = shuffle
  skip: typeof skip = skip
  skipUntil: typeof skipUntil = skipUntil
  skipWhile: typeof skipWhile = skipWhile
  slice: typeof slice = slice
  sole: typeof sole = sole
  some: typeof some = some
  sort: typeof sort = sort
  sortDesc: typeof sortDesc = sortDesc
  sortBy: typeof sortBy = sortBy
  sortByDesc: typeof sortByDesc = sortByDesc
  sortKeys: typeof sortKeys = sortKeys
  sortKeysDesc: typeof sortKeysDesc = sortKeysDesc
  splice: typeof splice = splice
  split: typeof split = split
  sum: typeof sum = sum
  take: typeof take = take
  takeUntil: typeof takeUntil = takeUntil
  takeWhile: typeof takeWhile = takeWhile
  tap: typeof tap = tap
  times: typeof times = times
  toArray: typeof toArray = toArray
  toJson: typeof toJson = toJson
  transform: typeof transform = transform
  undot: typeof undot = undot
  unless: typeof unless = unless
  unlessEmpty: typeof whenNotEmpty = whenNotEmpty
  unlessNotEmpty: typeof whenEmpty = whenEmpty
  union: typeof union = union
  unique: typeof unique = unique
  unwrap: typeof unwrap = unwrap
  values: typeof values = values
  when: typeof when = when
  whenEmpty: typeof whenEmpty = whenEmpty
  whenNotEmpty: typeof whenNotEmpty = whenNotEmpty
  where: typeof where = where
  whereBetween: typeof whereBetween = whereBetween
  whereIn: typeof whereIn = whereIn
  whereInstanceOf: typeof whereInstanceOf = whereInstanceOf
  whereNotBetween: typeof whereNotBetween = whereNotBetween
  whereNotIn: typeof whereNotIn = whereNotIn
  whereNull: typeof whereNull = whereNull
  whereNotNull: typeof whereNotNull = whereNotNull
  wrap: typeof wrap = wrap
  zip: typeof zip = zip
}

export const collect = <T extends object>(collection?: T | T[] | Collection<T>): Collection<T> =>
  new Collection<T>(collection)

export default collect
