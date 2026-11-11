/**
 * Turn any runtime value into a plain, JSON-safe description of it.
 *
 * A tinker result has to leave the process that produced it: over a pipe to a
 * desktop app, over SSH from a server, out of a container. `JSON.stringify`
 * loses most of what makes a result worth looking at (undefined, bigint, Date,
 * Map, Set, class names, cycles, errors), and `Bun.inspect` produces a string a
 * UI can only print. This produces a tree a UI can expand, sort and tabulate,
 * with every node tagged by what it was.
 *
 * It is bounded on purpose. A model collection with a million rows or an
 * object graph that reaches the whole app must not hang the session or flood
 * the pipe, so depth, items per container, string length and total nodes all
 * have limits, and every cut is recorded on the node (`more`, `truncated`)
 * rather than silently dropped.
 */

export interface SerializeLimits {
  /** How many levels of nesting to describe. Deeper containers become `{ t: 'cut' }`. */
  maxDepth: number
  /** Entries kept per array, object, map or set. */
  maxItems: number
  /** Characters kept per string. */
  maxString: number
  /** Total nodes in one description. Past this, containers stop filling. */
  maxNodes: number
}

export const defaultSerializeLimits: SerializeLimits = {
  maxDepth: 8,
  maxItems: 200,
  maxString: 20_000,
  maxNodes: 50_000,
}

export interface TinkerStackFrame {
  function?: string
  file?: string
  line?: number
  column?: number
}

export interface TinkerErrorValue {
  t: 'error'
  name: string
  message: string
  stack?: string
  frames?: TinkerStackFrame[]
  cause?: TinkerValue
  /** Own enumerable fields an error carries besides the standard ones (`code`, `status`, ...). */
  entries?: Array<[string, TinkerValue]>
}

export type TinkerValue =
  | { t: 'undefined' }
  | { t: 'null' }
  | { t: 'boolean', v: boolean }
  | { t: 'number', v: number | 'NaN' | 'Infinity' | '-Infinity' | '-0' }
  | { t: 'bigint', v: string }
  | { t: 'string', v: string, truncated?: number }
  | { t: 'symbol', v: string }
  | { t: 'function', name: string, kind: 'function' | 'async' | 'class' | 'generator' }
  | { t: 'date', v: string | null }
  | { t: 'regexp', v: string }
  | { t: 'url', v: string }
  | { t: 'promise' }
  | { t: 'bytes', ctor: string, length: number, hex: string }
  | { t: 'array', id: number, ctor?: string, length: number, items: TinkerValue[], more?: number }
  | { t: 'object', id: number, ctor?: string, entries: Array<[string, TinkerValue]>, more?: number }
  | { t: 'map', id: number, size: number, entries: Array<[TinkerValue, TinkerValue]>, more?: number }
  | { t: 'set', id: number, size: number, items: TinkerValue[], more?: number }
  | { t: 'ref', id: number }
  | { t: 'cut', reason: 'depth' | 'nodes', ctor?: string }
  | TinkerErrorValue

/**
 * Describes one kind of value the generic walk does not know about, such as an
 * ORM model. Return `undefined` to pass. `describe` continues the walk for
 * nested values so limits and cycle tracking stay in force.
 */
export type TinkerDescriber = (
  value: object,
  describe: (value: unknown) => TinkerValue,
) => TinkerValue | undefined

export interface SerializeOptions {
  limits?: Partial<SerializeLimits>
  describers?: TinkerDescriber[]
}

const STACK_LINE = /^\s*at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/

/** Parse a V8/JavaScriptCore `at fn (file:line:col)` stack into frames. */
export function parseStack(stack: string | undefined): TinkerStackFrame[] {
  if (!stack)
    return []
  const frames: TinkerStackFrame[] = []
  for (const line of stack.split('\n')) {
    const match = STACK_LINE.exec(line)
    if (!match)
      continue
    frames.push({
      function: match[1] || undefined,
      file: match[2],
      line: Number(match[3]),
      column: Number(match[4]),
    })
  }
  return frames
}

function functionKind(fn: (...args: unknown[]) => unknown): 'function' | 'async' | 'class' | 'generator' {
  const source = Function.prototype.toString.call(fn)
  if (source.startsWith('class'))
    return 'class'
  const ctor = fn.constructor?.name
  if (ctor === 'AsyncFunction' || ctor === 'AsyncGeneratorFunction')
    return 'async'
  if (ctor === 'GeneratorFunction')
    return 'generator'
  return 'function'
}

function constructorName(value: object): string | undefined {
  const proto = Object.getPrototypeOf(value)
  if (proto === null)
    return 'null prototype'
  const name = proto.constructor?.name
  return typeof name === 'string' && name && name !== 'Object' ? name : undefined
}

export function serialize(root: unknown, options: SerializeOptions = {}): TinkerValue {
  const limits: SerializeLimits = { ...defaultSerializeLimits, ...options.limits }
  const describers = options.describers ?? []
  const seen = new Map<object, number>()
  let nodes = 0
  let nextId = 1

  function walk(value: unknown, depth: number): TinkerValue {
    nodes++

    if (value === undefined)
      return { t: 'undefined' }
    if (value === null)
      return { t: 'null' }

    switch (typeof value) {
      case 'boolean':
        return { t: 'boolean', v: value }
      case 'number':
        if (Number.isNaN(value))
          return { t: 'number', v: 'NaN' }
        if (value === Number.POSITIVE_INFINITY)
          return { t: 'number', v: 'Infinity' }
        if (value === Number.NEGATIVE_INFINITY)
          return { t: 'number', v: '-Infinity' }
        if (Object.is(value, -0))
          return { t: 'number', v: '-0' }
        return { t: 'number', v: value }
      case 'bigint':
        return { t: 'bigint', v: value.toString() }
      case 'string':
        return value.length > limits.maxString
          ? { t: 'string', v: value.slice(0, limits.maxString), truncated: value.length - limits.maxString }
          : { t: 'string', v: value }
      case 'symbol':
        return { t: 'symbol', v: value.description ?? '' }
      case 'function':
        return { t: 'function', name: value.name || '(anonymous)', kind: functionKind(value as (...args: unknown[]) => unknown) }
    }

    const object = value as object
    const known = seen.get(object)
    if (known !== undefined)
      return { t: 'ref', id: known }

    if (object instanceof Date)
      return { t: 'date', v: Number.isNaN(object.getTime()) ? null : object.toISOString() }
    if (object instanceof RegExp)
      return { t: 'regexp', v: object.toString() }
    if (object instanceof URL)
      return { t: 'url', v: object.href }
    if (object instanceof Promise)
      return { t: 'promise' }
    if (ArrayBuffer.isView(object) || object instanceof ArrayBuffer) {
      const bytes = object instanceof ArrayBuffer
        ? new Uint8Array(object)
        : new Uint8Array(object.buffer, object.byteOffset, object.byteLength)
      return {
        t: 'bytes',
        ctor: object.constructor?.name ?? 'ArrayBuffer',
        length: bytes.byteLength,
        hex: Buffer.from(bytes.subarray(0, 64)).toString('hex'),
      }
    }

    if (depth >= limits.maxDepth)
      return { t: 'cut', reason: 'depth', ctor: constructorName(object) ?? (Array.isArray(object) ? 'Array' : 'Object') }
    if (nodes >= limits.maxNodes)
      return { t: 'cut', reason: 'nodes', ctor: constructorName(object) }

    const id = nextId++
    seen.set(object, id)
    const next = (inner: unknown): TinkerValue => walk(inner, depth + 1)

    if (object instanceof Error)
      return describeError(object, next)

    for (const describer of describers) {
      let described: TinkerValue | undefined
      try {
        described = describer(object, next)
      }
      catch {
        described = undefined
      }
      if (described)
        return described
    }

    if (Array.isArray(object)) {
      const items: TinkerValue[] = []
      const take = Math.min(object.length, limits.maxItems)
      for (let index = 0; index < take && nodes < limits.maxNodes; index++)
        items.push(next(object[index]))
      const more = object.length - items.length
      const ctor = constructorName(object)
      return { t: 'array', id, ...(ctor && ctor !== 'Array' ? { ctor } : {}), length: object.length, items, ...(more > 0 ? { more } : {}) }
    }

    if (object instanceof Map) {
      const entries: Array<[TinkerValue, TinkerValue]> = []
      for (const [key, inner] of object) {
        if (entries.length >= limits.maxItems || nodes >= limits.maxNodes)
          break
        entries.push([next(key), next(inner)])
      }
      const more = object.size - entries.length
      return { t: 'map', id, size: object.size, entries, ...(more > 0 ? { more } : {}) }
    }

    if (object instanceof Set) {
      const items: TinkerValue[] = []
      for (const inner of object) {
        if (items.length >= limits.maxItems || nodes >= limits.maxNodes)
          break
        items.push(next(inner))
      }
      const more = object.size - items.length
      return { t: 'set', id, size: object.size, items, ...(more > 0 ? { more } : {}) }
    }

    return describeObject(object, id, next)
  }

  function describeObject(object: object, id: number, next: (inner: unknown) => TinkerValue): TinkerValue {
    const ctor = constructorName(object)
    let source: object = object
    let keys = Object.keys(object)

    // A class instance that keeps its state private (a query result wrapper, a
    // collection) shows nothing through its own keys. Its toJSON is what it
    // chose to be seen as, so describe that under the class's name.
    if (keys.length === 0 && ctor && typeof (object as { toJSON?: unknown }).toJSON === 'function') {
      try {
        const json = (object as { toJSON: () => unknown }).toJSON()
        if (Array.isArray(json)) {
          const described = next(json)
          return described.t === 'array' ? { ...described, ctor } : described
        }
        if (json && typeof json === 'object') {
          source = json as object
          keys = Object.keys(source)
        }
      }
      catch {
        // Fall through to the empty object: a throwing toJSON is the value's problem, not the session's.
      }
    }

    const entries: Array<[string, TinkerValue]> = []
    for (const key of keys) {
      if (entries.length >= limits.maxItems || nodes >= limits.maxNodes)
        break
      let inner: unknown
      try {
        inner = (source as Record<string, unknown>)[key]
      }
      catch (error) {
        inner = error
      }
      entries.push([key, next(inner)])
    }
    const more = keys.length - entries.length
    return { t: 'object', id, ...(ctor ? { ctor } : {}), entries, ...(more > 0 ? { more } : {}) }
  }

  function describeError(error: Error, next: (inner: unknown) => TinkerValue): TinkerErrorValue {
    const described: TinkerErrorValue = {
      t: 'error',
      name: error.name || 'Error',
      message: String(error.message ?? ''),
    }
    if (typeof error.stack === 'string') {
      described.stack = error.stack
      const frames = parseStack(error.stack)
      if (frames.length)
        described.frames = frames
    }
    if (error.cause !== undefined)
      described.cause = next(error.cause)

    const entries: Array<[string, TinkerValue]> = []
    for (const key of Object.keys(error)) {
      if (key === 'name' || key === 'message' || key === 'stack' || key === 'cause')
        continue
      if (entries.length >= limits.maxItems)
        break
      entries.push([key, next((error as unknown as Record<string, unknown>)[key])])
    }
    if (entries.length)
      described.entries = entries
    return described
  }

  return walk(root, 0)
}

/** Describe anything thrown, including non-Error throws, as an error value. */
export function serializeThrown(thrown: unknown, options: SerializeOptions = {}): TinkerErrorValue {
  if (thrown instanceof Error)
    return serialize(thrown, options) as TinkerErrorValue
  return {
    t: 'error',
    name: 'Thrown',
    message: typeof thrown === 'string' ? thrown : Bun.inspect(thrown),
    cause: serialize(thrown, options),
  }
}
