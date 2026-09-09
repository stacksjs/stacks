import { describe, expect, it } from 'bun:test'
import { pipe, piped, tap } from '../src/pipe'

describe('pipe', () => {
  it('applies steps left to right', () => {
    expect(pipe(2, n => n + 3, n => n * 10)).toBe(50)
  })

  it('returns the value untouched when there are no steps', () => {
    const value = { a: 1 }
    expect(pipe(value)).toBe(value)
  })

  it('carries the type through each step', () => {
    // Annotated on the way out: if the overloads stopped threading types, the
    // result would be `unknown` and this would not compile.
    const length: number = pipe(
      [3, 1, 2],
      list => list.slice().sort((a, b) => a - b),
      list => list.map(String),
      list => list.join(','),
      joined => joined.length,
    )

    expect(length).toBe(5)
  })

  it('threads ten steps, the documented limit', () => {
    const result: number = pipe(
      0,
      n => n + 1,
      n => n + 1,
      n => n + 1,
      n => n + 1,
      n => n + 1,
      n => n + 1,
      n => n + 1,
      n => n + 1,
      n => n + 1,
    )

    expect(result).toBe(9)
  })

  it('passes a value through unchanged when a step is the identity', () => {
    const subject = { a: 1 }
    expect(pipe(subject, value => value)).toBe(subject)
  })

  it('does not swallow a throw from a step', () => {
    // A pipeline is not a try/catch. A step that fails fails the whole call,
    // and the steps after it never run.
    let reached = false
    expect(() => pipe(1, () => {
      throw new Error('step failed')
    }, () => {
      reached = true
      return 1
    })).toThrow('step failed')
    expect(reached).toBe(false)
  })

  it('runs steps in order, once each', () => {
    const order: string[] = []
    pipe(1, (n) => {
      order.push('first')
      return n
    }, (n) => {
      order.push('second')
      return n
    })

    expect(order).toEqual(['first', 'second'])
  })
})

describe('piped', () => {
  it('builds a reusable function rather than running now', () => {
    const normalize = piped(
      (name: string) => name.trim(),
      name => name.toLowerCase(),
    )

    expect(['  Ada ', 'GRACE'].map(normalize)).toEqual(['ada', 'grace'])
  })

  it('does not run any step until the function is called', () => {
    let calls = 0
    const built = piped((n: number) => {
      calls++
      return n
    })

    expect(calls).toBe(0)
    built(1)
    expect(calls).toBe(1)
  })

  it('carries types from the first step to the last', () => {
    const describeLength: (input: string[]) => string = piped(
      (list: string[]) => list.length,
      count => `${count} items`,
    )

    expect(describeLength(['a', 'b'])).toBe('2 items')
  })

  it('is reusable and holds no state between calls', () => {
    const increment = piped((n: number) => n + 1)
    expect(increment(1)).toBe(2)
    expect(increment(1)).toBe(2)
  })
})

describe('tap', () => {
  it('runs the effect and hands the value back unchanged', () => {
    const seen: number[] = []
    expect(pipe(5, tap(n => seen.push(n)), n => n * 2)).toBe(10)
    expect(seen).toEqual([5])
  })

  /**
   * The effect's return value is discarded deliberately: a step that means to
   * change the value should be an ordinary step, where the type says so. Here
   * the effect returns a string and the pipeline still sees the number.
   */
  it('discards what the effect returns', () => {
    expect(pipe(5, tap(() => 'ignored'))).toBe(5)
  })

  it('hands back the same reference, not a copy', () => {
    const subject = { a: 1 }
    expect(pipe(subject, tap(() => {}))).toBe(subject)
  })
})

describe('pipe and the transform helpers', () => {
  /**
   * The reason this exists at all (stacksjs/stacks#412). Data-first reads well
   * for one or two calls and inverts beyond that, because the first thing to
   * happen is written last. These two produce the same answer; the second reads
   * in the order it runs.
   */
  it('reads in execution order over the array helpers', async () => {
    const { sortBy, take } = await import('@stacksjs/arrays')
    const users = [
      { name: 'ada', score: 9 },
      { name: 'grace', score: 10 },
      { name: 'alan', score: 7 },
    ]

    const nested = take(sortBy(users, { by: user => user.score, order: 'desc' }), 2)
    const piped = pipe(
      users,
      list => sortBy(list, { by: user => user.score, order: 'desc' }),
      list => take(list, 2),
    )

    expect(piped).toEqual(nested)
    expect(piped.map(user => user.name)).toEqual(['grace', 'ada'])
  })
})
