/** Dynamic methods with constructor-local registration and reversible overrides. */
export interface MacroableConstructor {
  new (...args: any[]): any
  macro(name: string, fn: Function, replace?: boolean): void
  mixin(obj: Record<string, any>, replace?: boolean): void
  hasMacro(name: string): boolean
  flushMacros(): void
  getMacros(): string[]
}

// eslint-disable-next-line pickier/no-unused-vars
type Constructor = new (...args: any[]) => any

interface MacroTarget { prototype: object }
interface Registration { fn: Function, original?: PropertyDescriptor }
const registries = new WeakMap<MacroTarget, Map<string, Registration>>()

function parentOf(target: MacroTarget): MacroTarget | undefined {
  const parent = Object.getPrototypeOf(target)
  return typeof parent === 'function' && parent.prototype ? parent : undefined
}

/** Resolve effective inherited macros, stopping at a native method that shadows one. */
function registration(target: MacroTarget, name: string): Registration | undefined {
  for (let current: MacroTarget | undefined = target; current; current = parentOf(current)) {
    const own = registries.get(current)?.get(name)
    if (own) return own
    if (Object.hasOwn(current.prototype, name)) return undefined
  }
}

export class Macroable {
  static macro(this: MacroTarget, name: string, fn: Function, replace = false): void {
    if (name === 'constructor') throw new Error('The constructor cannot be a macro')
    if (typeof fn !== 'function') throw new TypeError('A macro must be a function')
    if (!replace && name in this.prototype) {
      if (registration(this, name)) throw new Error(`Macro "${name}" is already registered`)
      throw new Error(`Method "${name}" already exists; pass replace to override it`)
    }
    const records = registries.get(this) ?? new Map<string, Registration>()
    const previous = records.get(name)
    const original = previous ? previous.original : Object.getOwnPropertyDescriptor(this.prototype, name)
    // Installation may throw for a sealed prototype or permanent property. Publish only after it succeeds.
    Object.defineProperty(this.prototype, name, { value: fn, writable: true, configurable: true, enumerable: false })
    records.set(name, { fn, original })
    registries.set(this, records)
  }

  static mixin(this: MacroTarget & Pick<MacroableConstructor, 'macro'>, obj: Record<string, any>, replace = true): void {
    for (const name of Object.getOwnPropertyNames(obj)) {
      if (name === 'constructor' || (!replace && name in this.prototype)) continue
      const descriptor = Object.getOwnPropertyDescriptor(obj, name)
      if (descriptor && typeof descriptor.value === 'function') this.macro(name, descriptor.value, replace)
    }
  }

  static hasMacro(this: MacroTarget, name: string): boolean {
    return registration(this, name) !== undefined
  }

  /** Flush only this constructor's registrations, revealing inherited methods again. */
  static flushMacros(this: MacroTarget): void {
    const records = registries.get(this)
    if (!records) return
    for (const [name, record] of records) {
      if (record.original) Object.defineProperty(this.prototype, name, record.original)
      else if (!Reflect.deleteProperty(this.prototype, name)) throw new TypeError(`Cannot remove macro "${name}"`)
      records.delete(name)
    }
    registries.delete(this)
  }

  static getMacros(this: MacroTarget): string[] {
    const names = new Set<string>()
    for (let current: MacroTarget | undefined = this; current; current = parentOf(current)) {
      for (const name of registries.get(current)?.keys() ?? []) names.add(name)
    }
    return [...names].filter(name => registration(this, name) !== undefined)
  }

  protected callMacro(name: string, ...args: any[]): any {
    const found = registration(this.constructor, name)
    if (!found) throw new Error(`Macro "${name}" is not registered`)
    return found.fn.apply(this, args)
  }
}

export function createMacroable<T extends Constructor>(
  BaseClass: T = class {} as unknown as T,
): T & MacroableConstructor {
  return macroable(class extends BaseClass {}) as T & MacroableConstructor
}

/** Static methods use their receiver, so decorated subclasses own their mutations. */
export function macroable<T extends Constructor>(target: T): T & MacroableConstructor {
  const decorated = target as T & MacroableConstructor
  for (const name of ['macro', 'mixin', 'hasMacro', 'flushMacros', 'getMacros'] as const) {
    Object.defineProperty(decorated, name, { value: Macroable[name], writable: true, configurable: true })
  }
  return decorated
}
