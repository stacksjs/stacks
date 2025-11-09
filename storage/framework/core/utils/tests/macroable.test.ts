import { describe, expect, test, beforeEach } from 'bun:test'
import { Macroable, createMacroable, macroable } from '../src/macroable'

describe('Native Macroable', () => {
  describe('Macroable class', () => {
    class TestClass extends Macroable {
      value: string

      constructor(value: string) {
        super()
        this.value = value
      }

      getValue(): string {
        return this.value
      }
    }

    beforeEach(() => {
      TestClass.flushMacros()
    })

    test('can register a macro', () => {
      TestClass.macro('uppercase', function (this: TestClass) {
        return this.value.toUpperCase()
      })

      const instance = new TestClass('hello')
      expect((instance as any).uppercase()).toBe('HELLO')
    })

    test('can check if macro exists', () => {
      expect(TestClass.hasMacro('uppercase')).toBe(false)

      TestClass.macro('uppercase', function (this: TestClass) {
        return this.value.toUpperCase()
      })

      expect(TestClass.hasMacro('uppercase')).toBe(true)
    })

    test('can flush macros', () => {
      TestClass.macro('uppercase', function (this: TestClass) {
        return this.value.toUpperCase()
      })

      expect(TestClass.hasMacro('uppercase')).toBe(true)

      TestClass.flushMacros()

      expect(TestClass.hasMacro('uppercase')).toBe(false)
    })

    test('can get all macro names', () => {
      TestClass.macro('uppercase', function () {})
      TestClass.macro('lowercase', function () {})

      const macros = TestClass.getMacros()
      expect(macros).toContain('uppercase')
      expect(macros).toContain('lowercase')
      expect(macros.length).toBe(2)
    })

    test('throws error when registering duplicate macro', () => {
      TestClass.macro('test', function () {})

      expect(() => {
        TestClass.macro('test', function () {})
      }).toThrow('Macro "test" is already registered')
    })

    test('macro has access to instance context', () => {
      TestClass.macro('getValue', function (this: TestClass) {
        return this.value
      })

      const instance = new TestClass('test')
      expect((instance as any).getValue()).toBe('test')
    })

    test('macro can accept arguments', () => {
      TestClass.macro('repeat', function (this: TestClass, times: number) {
        return this.value.repeat(times)
      })

      const instance = new TestClass('ha')
      expect((instance as any).repeat(3)).toBe('hahaha')
    })

    test('can mixin multiple methods', () => {
      const mixin = {
        uppercase(this: TestClass) {
          return this.value.toUpperCase()
        },
        lowercase(this: TestClass) {
          return this.value.toLowerCase()
        },
        capitalize(this: TestClass) {
          return this.value.charAt(0).toUpperCase() + this.value.slice(1)
        },
      }

      TestClass.mixin(mixin)

      const instance = new TestClass('hello')
      expect((instance as any).uppercase()).toBe('HELLO')
      expect((instance as any).lowercase()).toBe('hello')
      expect((instance as any).capitalize()).toBe('Hello')
    })

    test('mixin respects replace parameter', () => {
      TestClass.macro('test', function () {
        return 'original'
      })

      const mixin = {
        test() {
          return 'replaced'
        },
      }

      // Should replace by default
      TestClass.mixin(mixin)
      const instance1 = new TestClass('value')
      expect((instance1 as any).test()).toBe('replaced')

      TestClass.flushMacros()
      TestClass.macro('test', function () {
        return 'original'
      })

      // Should not replace when replace = false
      TestClass.mixin(mixin, false)
      const instance2 = new TestClass('value')
      expect((instance2 as any).test()).toBe('original')
    })
  })

  describe('createMacroable function', () => {
    test('creates macroable class from scratch', () => {
      const MacroableClass = createMacroable()

      MacroableClass.macro('test', function () {
        return 'hello'
      })

      const instance = new MacroableClass()
      expect((instance as any).test()).toBe('hello')
    })

    test('creates macroable class from existing class', () => {
      class Base {
        name: string

        constructor(name: string) {
          this.name = name
        }

        getName(): string {
          return this.name
        }
      }

      const MacroableBase = createMacroable(Base)

      MacroableBase.macro('getUpperName', function (this: any) {
        return this.name.toUpperCase()
      })

      const instance = new MacroableBase('test')
      expect(instance.getName()).toBe('test')
      expect((instance as any).getUpperName()).toBe('TEST')
    })
  })

  describe('macroable decorator', () => {
    test('adds macroable functionality to existing class', () => {
      class Original {
        value: number

        constructor(value: number) {
          this.value = value
        }

        getValue(): number {
          return this.value
        }
      }

      const MacroableOriginal = macroable(Original)

      MacroableOriginal.macro('double', function (this: any) {
        return this.value * 2
      })

      MacroableOriginal.macro('triple', function (this: any) {
        return this.value * 3
      })

      const instance = new MacroableOriginal(5)
      expect(instance.getValue()).toBe(5)
      expect((instance as any).double()).toBe(10)
      expect((instance as any).triple()).toBe(15)
    })

    test('maintains original class functionality', () => {
      class Calculator {
        add(a: number, b: number): number {
          return a + b
        }

        subtract(a: number, b: number): number {
          return a - b
        }
      }

      const MacroableCalculator = macroable(Calculator)

      MacroableCalculator.macro('multiply', function (a: number, b: number) {
        return a * b
      })

      const calc = new MacroableCalculator()
      expect(calc.add(2, 3)).toBe(5)
      expect(calc.subtract(5, 2)).toBe(3)
      expect((calc as any).multiply(3, 4)).toBe(12)
    })
  })

  describe('Real-world use cases', () => {
    test('String utilities with macros', () => {
      class Str extends Macroable {
        value: string

        constructor(value: string) {
          super()
          this.value = value
        }

        toString(): string {
          return this.value
        }
      }

      // Add custom string methods
      Str.macro('reverse', function (this: Str) {
        return this.value.split('').reverse().join('')
      })

      Str.macro('truncate', function (this: Str, length: number, suffix = '...') {
        if (this.value.length <= length) return this.value
        return this.value.slice(0, length) + suffix
      })

      Str.macro('words', function (this: Str) {
        return this.value.split(/\s+/)
      })

      const str = new Str('Hello World from Stacks')
      expect((str as any).reverse()).toBe('skcatS morf dlroW olleH')
      expect((str as any).truncate(10)).toBe('Hello Worl...')
      expect((str as any).words()).toEqual(['Hello', 'World', 'from', 'Stacks'])
    })

    test('Collection with custom methods', () => {
      class Collection<T> extends Macroable {
        items: T[]

        constructor(items: T[]) {
          super()
          this.items = items
        }

        all(): T[] {
          return this.items
        }
      }

      Collection.macro('first', function <T>(this: Collection<T>) {
        return this.items[0]
      })

      Collection.macro('last', function <T>(this: Collection<T>) {
        return this.items[this.items.length - 1]
      })

      Collection.macro('pluck', function <T>(this: Collection<T>, key: keyof T) {
        return this.items.map(item => item[key])
      })

      const users = new Collection([
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
        { name: 'Bob', age: 35 },
      ])

      expect((users as any).first()).toEqual({ name: 'John', age: 30 })
      expect((users as any).last()).toEqual({ name: 'Bob', age: 35 })
      expect((users as any).pluck('name')).toEqual(['John', 'Jane', 'Bob'])
    })

    test('API builder with macros', () => {
      class ApiBuilder extends Macroable {
        private url: string = ''
        private params: Record<string, string> = {}

        setUrl(url: string): this {
          this.url = url
          return this
        }

        setParam(key: string, value: string): this {
          this.params[key] = value
          return this
        }

        build(): string {
          const query = new URLSearchParams(this.params).toString()
          return query ? `${this.url}?${query}` : this.url
        }
      }

      // Add custom methods for specific API needs
      ApiBuilder.macro('withAuth', function (this: ApiBuilder, token: string) {
        return this.setParam('token', token)
      })

      ApiBuilder.macro('withPage', function (this: ApiBuilder, page: number) {
        return this.setParam('page', page.toString())
      })

      const api = new ApiBuilder()
      const url = api
        .setUrl('https://api.example.com/users')
        ;(api as any).withAuth('secret123')
        ;(api as any).withPage(2)

      expect(api.build()).toBe('https://api.example.com/users?token=secret123&page=2')
    })
  })
})
