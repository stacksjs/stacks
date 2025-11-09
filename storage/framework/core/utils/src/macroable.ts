/**
 * Native Macroable implementation
 * Inspired by Laravel's Macroable trait - allows adding methods dynamically to classes
 */

export interface MacroableConstructor {
  new (...args: any[]): any
  macro(name: string, fn: Function, replace?: boolean): void
  mixin(obj: Record<string, any>, replace?: boolean): void
  hasMacro(name: string): boolean
  flushMacros(): void
  getMacros(): string[]
}

export class Macroable {
  private static macros: Map<string, Function> = new Map()

  /**
   * Register a custom macro
   */
  static macro(name: string, fn: Function, replace = false): void {
    if (this.macros.has(name) && !replace) {
      throw new Error(`Macro "${name}" is already registered`)
    }
    this.macros.set(name, fn)

    // Add the macro as a method to the class prototype
    Object.defineProperty(this.prototype, name, {
      value: fn,
      writable: true,
      configurable: true,
      enumerable: false,
    })
  }

  /**
   * Mix in methods from an object
   */
  static mixin(obj: Record<string, any>, replace = true): void {
    const methods = Object.getOwnPropertyNames(obj)

    for (const method of methods) {
      if (method === 'constructor') continue

      if (this.macros.has(method) && !replace) {
        continue
      }

      const descriptor = Object.getOwnPropertyDescriptor(obj, method)
      if (descriptor && typeof descriptor.value === 'function') {
        this.macro(method, descriptor.value, replace)
      }
    }
  }

  /**
   * Check if a macro is registered
   */
  static hasMacro(name: string): boolean {
    return this.macros.has(name)
  }

  /**
   * Remove all macros
   */
  static flushMacros(): void {
    // Remove all macro methods from prototype
    for (const name of this.macros.keys()) {
      delete (this.prototype as any)[name]
    }
    this.macros.clear()
  }

  /**
   * Get all registered macros
   */
  static getMacros(): string[] {
    return Array.from(this.macros.keys())
  }

  /**
   * Call a macro if it exists
   */
  protected callMacro(name: string, ...args: any[]): any {
    const macro = (this.constructor as typeof Macroable).macros.get(name)
    if (!macro) {
      throw new Error(`Macro "${name}" is not registered`)
    }
    return macro.apply(this, args)
  }
}

/**
 * Create a macroable class
 */
export function createMacroable<T extends new (...args: any[]) => any>(
  BaseClass: T = class {} as any,
): T & MacroableConstructor {
  return class extends BaseClass {
    private static macros: Map<string, Function> = new Map()

    static macro(name: string, fn: Function, replace = false): void {
      if (this.macros.has(name) && !replace) {
        throw new Error(`Macro "${name}" is already registered`)
      }
      this.macros.set(name, fn)

      Object.defineProperty(this.prototype, name, {
        value: fn,
        writable: true,
        configurable: true,
        enumerable: false,
      })
    }

    static mixin(obj: Record<string, any>, replace = true): void {
      const methods = Object.getOwnPropertyNames(obj)

      for (const method of methods) {
        if (method === 'constructor') continue

        if (this.macros.has(method) && !replace) {
          continue
        }

        const descriptor = Object.getOwnPropertyDescriptor(obj, method)
        if (descriptor && typeof descriptor.value === 'function') {
          this.macro(method, descriptor.value, replace)
        }
      }
    }

    static hasMacro(name: string): boolean {
      return this.macros.has(name)
    }

    static flushMacros(): void {
      for (const name of this.macros.keys()) {
        delete (this.prototype as any)[name]
      }
      this.macros.clear()
    }

    static getMacros(): string[] {
      return Array.from(this.macros.keys())
    }
  } as T & MacroableConstructor
}

/**
 * Mixin for adding macroable functionality to existing classes
 */
export function macroable<T extends new (...args: any[]) => any>(
  target: T,
): T & MacroableConstructor {
  const macros = new Map<string, Function>()

  // Add static methods
  ;(target as any).macro = function (name: string, fn: Function, replace = false): void {
    if (macros.has(name) && !replace) {
      throw new Error(`Macro "${name}" is already registered`)
    }
    macros.set(name, fn)

    Object.defineProperty(target.prototype, name, {
      value: fn,
      writable: true,
      configurable: true,
      enumerable: false,
    })
  }

  ;(target as any).mixin = function (obj: Record<string, any>, replace = true): void {
    const methods = Object.getOwnPropertyNames(obj)

    for (const method of methods) {
      if (method === 'constructor') continue

      if (macros.has(method) && !replace) {
        continue
      }

      const descriptor = Object.getOwnPropertyDescriptor(obj, method)
      if (descriptor && typeof descriptor.value === 'function') {
        ;(target as any).macro(method, descriptor.value, replace)
      }
    }
  }

  ;(target as any).hasMacro = function (name: string): boolean {
    return macros.has(name)
  }

  ;(target as any).flushMacros = function (): void {
    for (const name of macros.keys()) {
      delete (target.prototype as any)[name]
    }
    macros.clear()
  }

  ;(target as any).getMacros = function (): string[] {
    return Array.from(macros.keys())
  }

  return target as T & MacroableConstructor
}
