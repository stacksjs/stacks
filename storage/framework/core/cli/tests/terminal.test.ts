import { describe, expect, it } from 'bun:test'
import { green } from '../src/utils'
import { progress, table, tasks } from '../src/terminal'

describe('table', () => {
  it('aligns columns to their widest cell', () => {
    expect(table([{ name: 'a', size: '1' }, { name: 'long', size: '22' }])).toBe(
      [
        'name  size',
        '----  ----',
        'a     1',
        'long  22',
      ].join('\n'),
    )
  })

  it('measures width with ANSI stripped', () => {
    // A colored cell is 9 characters of escape sequence longer than it looks;
    // counting those pushes every later column out by that much.
    const rendered = table([{ name: green('a') }, { name: 'long' }])
    expect(rendered.split('\n').at(-1)).toBe('long')
  })

  it('renders an empty cell for a missing or null key', () => {
    expect(table([{ a: 1, b: 2 }, { a: 3 }])).toBe(
      ['a  b', '-  -', '1  2', '3'].join('\n'),
    )
  })

  it('takes the union of every row s keys, in first-seen order', () => {
    expect(table([{ a: 1 }, { b: 2 }]).split('\n')[0]).toBe('a  b')
  })

  it('honours explicit columns, headers and right alignment', () => {
    expect(table([{ n: '1' }, { n: '100' }], {
      columns: [{ key: 'n', header: 'Count', align: 'right' }],
    })).toBe(['Count', '-----', '    1', '  100'].join('\n'))
  })

  it('omits the header when asked', () => {
    expect(table([{ a: 1 }], { header: false })).toBe('1')
  })

  it('returns an empty string when there is nothing to render', () => {
    expect(table([])).toBe('')
  })
})

describe('tasks', () => {
  it('runs in order and reports each outcome', async () => {
    const order: string[] = []
    const outcomes = await tasks([
      { title: 'one', task: () => { order.push('one') } },
      { title: 'two', task: async () => { order.push('two') } },
    ])

    expect(order).toEqual(['one', 'two'])
    expect(outcomes.map(o => o.status)).toEqual(['done', 'done'])
  })

  it('skips without running the task', async () => {
    let ran = false
    const outcomes = await tasks([
      { title: 'one', task: () => { ran = true }, skip: () => 'already installed' },
    ])

    expect(ran).toBe(false)
    expect(outcomes[0]!.status).toBe('skipped')
  })

  it('stops at the first failure rather than continuing the procedure', async () => {
    let laterRan = false
    // "build" after a failed "install" fails differently and confusingly.
    await expect(tasks([
      { title: 'install', task: () => { throw new Error('boom') } },
      { title: 'build', task: () => { laterRan = true } },
    ])).rejects.toThrow('boom')

    expect(laterRan).toBe(false)
  })
})

describe('progress', () => {
  it('rejects a total that cannot make a ratio', () => {
    // Otherwise every update divides by zero and renders NaN%.
    expect(() => progress({ total: 0 })).toThrow(TypeError)
    expect(() => progress({ total: -1 })).toThrow(TypeError)
    expect(() => progress({ total: Number.NaN })).toThrow(TypeError)
  })

  it('clamps to the range rather than overflowing the bar', () => {
    const bar = progress({ total: 10 })
    bar.update(50)
    expect(bar.value).toBe(10)
    bar.update(-5)
    expect(bar.value).toBe(0)
  })

  it('increments from wherever it is', () => {
    const bar = progress({ total: 10 })
    bar.update(3)
    bar.increment()
    bar.increment(2)
    expect(bar.value).toBe(6)
  })
})
