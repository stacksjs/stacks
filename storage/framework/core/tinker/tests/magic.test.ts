import { describe, expect, test } from 'bun:test'
import { instrumentMagicComments } from '../src/magic'

const names = { probe: 'P', time: 'T' }
const run = (code: string): string => instrumentMagicComments(code, names).code

describe('magic comments', () => {
  test('a declaration shows the name it binds', () => {
    expect(run('const users = await User.all() //?')).toBe('const users = await User.all();P(0, users)')
    expect(run('let n = 1; //?')).toBe('let n = 1;;P(0, n)')
  })

  test('a destructuring declaration shows every name it binds, not its keys', () => {
    expect(run('const { a, b: renamed, c = 2 } = thing //?')).toBe('const { a, b: renamed, c = 2 } = thing;P(0, { a, renamed, c })')
  })

  test('an expression statement is wrapped where it stands', () => {
    expect(run('User.count() //?')).toBe('P(0, (User.count()))')
    expect(run('x = 5 //?')).toBe('P(0, (x = 5))')
  })

  test('a chain broken over lines is one statement, and no line is added or removed', () => {
    const source = 'const a = 1\nusers\n  .filter(u => u.active)\n  .map(u => u.name) //?\nconst b = 2'
    const out = run(source)
    expect(out).toBe('const a = 1\nP(3, (users\n  .filter(u => u.active)\n  .map(u => u.name)))\nconst b = 2')
    expect(out.split('\n').length).toBe(source.split('\n').length)
  })

  test('a statement after a block does not swallow the block', () => {
    expect(run('if (x) {\n  y()\n}\nz() //?')).toBe('if (x) {\n  y()\n}\nP(3, (z()))')
  })

  test('inside a callback the probe stays inside it', () => {
    expect(run('repos.map((repo) => {\n  repo.id //?\n  return repo\n})')).toBe('repos.map((repo) => {\n  P(1, (repo.id))\n  return repo\n})')
    expect(run('repos.map(repo => repo.id //?\n)')).toBe('repos.map(repo => P(0, (repo.id))\n)')
  })

  test('return shows what is returned', () => {
    expect(run('function f() {\n  return a + b //?\n}')).toBe('function f() {\n  return P(1, (a + b))\n}')
  })

  test('a block comment inspects the expression before it and leaves the chain intact', () => {
    expect(run('list.filter(f)/*?*/.map(g)')).toBe('P(0, (list.filter(f))).map(g)')
    expect(run('list.filter(f)/*?.length*/.map(g)')).toBe('P(0, (list.filter(f)), __v => __v.length).map(g)')
    expect(run('const r = await Http.get(url)/*?.status()*/')).toBe('const r = P(0, (await Http.get(url)), __v => __v.status())')
    expect(run('rows[0]/*?*/')).toBe('P(0, (rows[0]))')
  })

  test('both kinds on one statement', () => {
    expect(run('list.filter(f)/*?.length*/.map(g) //?')).toBe('P(0, (P(0, (list.filter(f)), __v => __v.length).map(g)))')
  })

  test('timing marks the end of a statement', () => {
    expect(run('await slow() //?.')).toBe('T(0, (await slow()))')
    expect(run('await slow() /*?.*/')).toBe('T(0, (await slow()))')
    expect(run('const r = await slow() //?.')).toBe('const r = await slow();T(0)')
  })

  test('markers inside strings, templates and regexes are text, not comments', () => {
    const source = 'const a = "//?"\nconst b = `x ${"//?"} /*?*/`\nconst c = /\\/\\/?/\n'
    expect(run(source)).toBe(source)
  })

  test('what cannot be placed is left alone', () => {
    expect(run('if (x) { y() } //?')).toBe('if (x) { y() } //?')
    expect(run('//?')).toBe('//?')
    expect(run('for (const i of list) {} //?')).toBe('for (const i of list) {} //?')
  })

  test('an ordinary comment is untouched', () => {
    expect(run('a() // ? not magic\nb() /* ?nope */')).toBe('a() // ? not magic\nb() /* ?nope */')
  })

  test('reports the probes it placed, in source order', () => {
    expect(instrumentMagicComments('a() //?\nb() //?.\nc()/*?*/', names).probes).toEqual([
      { line: 0, kind: 'value' },
      { line: 1, kind: 'time' },
      { line: 2, kind: 'value' },
    ])
  })
})
