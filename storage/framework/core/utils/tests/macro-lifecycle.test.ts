import { expect, test } from 'bun:test'
import { Macroable, createMacroable, macroable } from '../src/macroable'

const factories = [() => class extends Macroable {}, () => createMacroable(), () => macroable(class {})]
for (const [index, factory] of factories.entries()) {
  test(`macro API ${index} isolates siblings and inherits base macros without sharing mutations`, () => {
    const Base = factory()
    class A extends Base {}
    class B extends Base {}
    Base.macro('base', function (this: object) { return this })
    A.macro('own', () => 'a')
    try {
      expect(A.hasMacro('base')).toBe(true)
      expect(B.hasMacro('own')).toBe(false)
      expect(Object.hasOwn(Base.prototype, 'own')).toBe(false)
      expect((new A() as any).base()).toBeInstanceOf(A)
      A.macro('base', () => 'override', true)
      expect((new A() as any).base()).toBe('override')
      A.flushMacros()
      expect(A.hasMacro('own')).toBe(false)
      expect(B.hasMacro('base')).toBe(true)
      expect((new A() as any).base()).toBeInstanceOf(A)
      expect(A.getMacros()).toEqual(['base'])
    }
    finally { A.flushMacros(); B.flushMacros(); Base.flushMacros() }
  })

  test(`macro API ${index} publishes only successfully installed methods`, () => {
    const Base = factory()
    Object.defineProperty(Base.prototype, 'locked', { value: () => 'original', configurable: false })
    expect(() => Base.macro('locked', () => 'bad', true)).toThrow()
    expect(Base.hasMacro('locked')).toBe(false)
    expect(Base.getMacros()).toEqual([])
    Base.macro('valid', () => 1)
    expect(() => Base.flushMacros()).not.toThrow()
    expect((new Base() as any).locked()).toBe('original')
  })

  test(`macro API ${index} requires opt-in for original methods and restores descriptors`, () => {
    const Base = factory()
    const original = { get: () => 'original', configurable: true, enumerable: true }
    Object.defineProperty(Base.prototype, 'read', original)
    expect(() => Base.macro('read', () => 'bad')).toThrow()
    Base.macro('read', () => 'first', true)
    Base.macro('read', () => 'second', true)
    expect((new Base() as any).read()).toBe('second')
    Base.flushMacros()
    expect(Object.getOwnPropertyDescriptor(Base.prototype, 'read')).toEqual(original)
    expect((new Base() as any).read).toBe('original')
    expect(() => Base.macro('constructor', () => 0, true)).toThrow()
  })
}


test('a macro made permanent externally cannot be silently forgotten during flush', () => {
  const Base = createMacroable()
  Base.macro('permanent', () => 1)
  Object.defineProperty(Base.prototype, 'permanent', { configurable: false })
  expect(() => Base.flushMacros()).toThrow(TypeError)
  expect(Base.hasMacro('permanent')).toBe(true)
})
