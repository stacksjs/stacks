import { describe, expect, test } from 'bun:test'
import { Mailable } from '../src/mailable'

// stacksjs/stacks#1903 (C1) — `Mailable<TProps>` generic propagation.
//
// The runtime work here is minimal — the generic flows through
// `.template()`'s parameter type and `inspect()`'s return type. These
// tests double as type-checking fixtures: the `@ts-expect-error`
// markers fail compilation if the surface ever drifts, which surfaces
// in `tsc --noEmit` runs even though `bun test` would happily ignore
// pure-TS errors. The accompanying runtime asserts also confirm the
// values round-trip correctly so we're not just testing the type
// system in isolation.

interface WelcomeProps extends Record<string, unknown> {
  userName: string
  orderId: number
}

class TypedWelcome extends Mailable<WelcomeProps> {
  constructor(private readonly p: WelcomeProps) { super() }
  build(): this {
    return this
      .to('user@example.com')
      .subject(`Order #${this.p.orderId}`)
      .template('welcome', { userName: this.p.userName, orderId: this.p.orderId })
  }
}

class LooseMail extends Mailable {
  build(): this {
    return this
      .to('user@example.com')
      .subject('Hi')
      // Default generic — any object literal is accepted, including
      // omitting `props` entirely (back-compat path).
      .template('hello', { whatever: 1, and: 'more', or: true })
  }
}

class LooseNoProps extends Mailable {
  build(): this {
    return this
      .to('user@example.com')
      .subject('Hi')
      .template('hello')
  }
}

describe('Mailable<TProps> typing (stacksjs/stacks#1903)', () => {
  test('typed Mailable instantiates and builds with the right shape', async () => {
    const m = new TypedWelcome({ userName: 'Ada', orderId: 42 })
    await m.build()
    const insp = m.inspect()
    expect(insp.template?.name).toBe('welcome')
    expect(insp.template?.props.userName).toBe('Ada')
    expect(insp.template?.props.orderId).toBe(42)
  })

  test('loose Mailable accepts any object literal', async () => {
    const m = new LooseMail()
    await m.build()
    const insp = m.inspect()
    expect(insp.template?.name).toBe('hello')
    expect(insp.template?.props).toEqual({ whatever: 1, and: 'more', or: true })
  })

  test('loose Mailable can call .template(name) with no props (back-compat)', async () => {
    const m = new LooseNoProps()
    await m.build()
    const insp = m.inspect()
    expect(insp.template?.name).toBe('hello')
    expect(insp.template?.props).toEqual({})
  })

  test('typed Mailable.inspect() exposes typed template.props', async () => {
    const m = new TypedWelcome({ userName: 'Ada', orderId: 42 })
    await m.build()
    const insp = m.inspect()
    // The narrow type here is the real assertion — at runtime we just
    // confirm the value flows through unchanged.
    const userName: string = insp.template?.props.userName ?? ''
    const orderId: number = insp.template?.props.orderId ?? 0
    expect(userName).toBe('Ada')
    expect(orderId).toBe(42)
  })

  // Compile-time regression guards. These don't fail at runtime; they
  // fail in TypeScript checking (e.g. `bun tsc --noEmit` or the project's
  // type-check step). If the `@ts-expect-error` markers ever become
  // unused, TS reports "Unused @ts-expect-error directive" — which is
  // exactly what tells us the type surface has regressed.
  test('typed Mailable rejects wrong-shape props at compile time', () => {
    class _Bad extends Mailable<WelcomeProps> {
      build(): this {
        // @ts-expect-error - missing required `orderId`
        this.template('welcome', { userName: 'Ada' })
        // @ts-expect-error - wrong type for `orderId`
        this.template('welcome', { userName: 'Ada', orderId: 'not-a-number' })
        // @ts-expect-error - props is required when TProps is concrete
        this.template('welcome')
        // Valid call — keeps the test body live so `_Bad` isn't tree-shaken.
        return this.template('welcome', { userName: 'Ada', orderId: 1 })
      }
    }
    expect(new _Bad()).toBeInstanceOf(Mailable)
  })
})
