import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFrameReader, encodeFrame, FRAME_MARKER } from '../src/protocol'
import { relationsOf, serialize, TinkerPreview } from '../src/serialize'
import { compileSnippet } from '../src/session'

// A session patches console and process streams and changes directory, so each
// one runs in its own process. That is also how it is used.
async function runSession(script: string, cwd = mkdtempSync(join(tmpdir(), 'tinker-'))): Promise<{ out: string, err: string, code: number, cwd: string }> {
  const entry = join(mkdtempSync(join(tmpdir(), 'tinker-entry-')), 'entry.ts')
  writeFileSync(entry, `import { createTinkerSession } from ${JSON.stringify(join(import.meta.dir, '../src/session.ts'))}
import { serveTinker } from ${JSON.stringify(join(import.meta.dir, '../src/protocol.ts'))}
import { writeSync } from 'node:fs'
const say = (value: unknown) => writeSync(1, JSON.stringify(value) + '\\n')
${script}
`)
  const proc = Bun.spawn([process.execPath, entry], { cwd, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  proc.stdin.end()
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  return { out, err, code, cwd }
}

const lines = (out: string): any[] => out.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))

describe('tinker session', () => {
  test('runs several statements and returns the last expression', async () => {
    const { out } = await runSession(`
const s = await createTinkerSession({ boot: false })
const r = await s.evaluate('const a: number = 20; let b = a + 1; b * 2')
say({ ok: r.ok, value: r.value })`)
    expect(lines(out)[0]).toEqual({ ok: true, value: 42 })
  })

  test('keeps declarations, functions and classes between evaluations', async () => {
    const { out } = await runSession(`
const s = await createTinkerSession({ boot: false })
await s.evaluate('const base = 10; function twice(n: number) { return n * 2 }; class Box { v = 5 }')
const r = await s.evaluate('twice(base) + new Box().v')
const again = await s.evaluate('const base = 1; base')
say({ value: r.value, redeclared: again.value })`)
    expect(lines(out)[0]).toEqual({ value: 25, redeclared: 1 })
  })

  test('supports top-level await and imports', async () => {
    const { out } = await runSession(`
const s = await createTinkerSession({ boot: false })
const r = await s.evaluate("import { join } from 'node:path'\\nawait Promise.resolve(join('a', 'b'))")
say({ value: r.value })`)
    expect(lines(out)[0]).toEqual({ value: 'a/b' })
  })

  test('resolves a relative import against the session directory', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tinker-rel-'))
    writeFileSync(join(cwd, 'thing.ts'), 'export const thing = 7\n')
    const { out } = await runSession(`
const s = await createTinkerSession({ boot: false })
const r = await s.evaluate("const m = await import('./thing.ts'); m.thing")
say({ value: r.value })`, cwd)
    expect(lines(out)[0]).toEqual({ value: 7 })
  })

  test('captures console output as frames in order, before the result', async () => {
    const { out } = await runSession(`
const s = await createTinkerSession({ boot: false })
const r = await s.evaluate("console.log('one', { a: 1 }); console.error('two'); process.stdout.write('three'); 3")
say(r.frames.map(f => [f.type, (f as any).text]))`)
    expect(lines(out)[0]).toEqual([
      ['stdout', 'one {\n  a: 1,\n}\n'],
      ['stderr', 'two\n'],
      ['stdout', 'three'],
      ['result', null],
      ['done', null],
    ])
  })

  test('reports a thrown error with its message and does not end the session', async () => {
    const { out } = await runSession(`
const s = await createTinkerSession({ boot: false })
const bad = await s.evaluate("throw new TypeError('boom')")
const frame = bad.frames.find(f => f.type === 'error') as any
const good = await s.evaluate('1 + 1')
say({ ok: bad.ok, phase: frame.phase, name: frame.error.name, message: frame.error.message, next: good.value })`)
    expect(lines(out)[0]).toEqual({ ok: false, phase: 'run', name: 'TypeError', message: 'boom', next: 2 })
  })

  test('reports a syntax error as a parse failure with a position', async () => {
    const { out } = await runSession(`
const s = await createTinkerSession({ boot: false })
const bad = await s.evaluate('const = 1')
const frame = bad.frames.find(f => f.type === 'error') as any
say({ ok: bad.ok, phase: frame.phase, line: frame.diagnostics[0]?.line, has: frame.diagnostics.length > 0 })`)
    expect(lines(out)[0]).toEqual({ ok: false, phase: 'parse', line: 1, has: true })
  })

  test('dump emits a frame and dd stops the run without failing it', async () => {
    const { out } = await runSession(`
const s = await createTinkerSession({ boot: false })
const r = await s.evaluate("dump({ a: 1 }); dd('stop'); globalThis.reached = true")
say({ ok: r.ok, dumps: r.frames.filter(f => f.type === 'dump').length, reached: (globalThis as any).reached === true })`)
    expect(lines(out)[0]).toEqual({ ok: true, dumps: 2, reached: false })
  })

  test('leaves no file behind in the project', async () => {
    const { cwd } = await runSession(`
const s = await createTinkerSession({ boot: false })
await s.evaluate('const x = 1; x')`)
    expect(readdirSync(cwd)).toEqual([])
  })

  test('serve speaks marked frames: ready, then the run, on one request', async () => {
    const entryDir = mkdtempSync(join(tmpdir(), 'tinker-serve-'))
    const entry = join(entryDir, 'serve.ts')
    writeFileSync(entry, `import { serveTinker } from ${JSON.stringify(join(import.meta.dir, '../src/protocol.ts'))}
const { ok } = await serveTinker({ boot: false })
process.exit(ok ? 0 : 1)
`)
    const proc = Bun.spawn([process.execPath, entry], { cwd: entryDir, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
    proc.stdin.write(`${JSON.stringify({ op: 'eval', id: 'a', code: 'console.log("hi"); const n = 2; n' })}\n`)
    proc.stdin.write(`${JSON.stringify({ op: 'eval', id: 'b', code: 'n * 21' })}\n`)
    proc.stdin.write(`${JSON.stringify({ op: 'exit' })}\n`)
    proc.stdin.end()
    const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
    const reader = createFrameReader()
    const frames = reader.push(out).flatMap(item => 'frame' in item ? [item.frame as any] : [])
    expect(code).toBe(0)
    expect(frames[0].type).toBe('ready')
    expect(frames[0].session.booted).toBe(false)
    expect(frames[0].protocol).toBe(2)
    expect(frames.filter(f => f.type === 'stdout' && f.id === 'a').map(f => f.text)).toEqual(['hi\n'])
    expect(frames.find(f => f.type === 'result' && f.id === 'b').value).toEqual({ t: 'number', v: 42 })
    expect(frames.filter(f => f.type === 'done').map(f => [f.id, f.ok])).toEqual([['a', true], ['b', true]])
  })
})

describe('frame reader', () => {
  test('separates frames from stray output and holds a partial line', () => {
    const reader = createFrameReader()
    const frame = encodeFrame({ type: 'pong' })
    const first = reader.push(`stray line\n${frame.slice(0, 5)}`)
    const second = reader.push(`${frame.slice(5)}tail`)
    expect(first).toEqual([{ stray: 'stray line' }])
    expect(second).toEqual([{ frame: { type: 'pong' } }])
    expect(reader.flush()).toEqual([{ stray: 'tail' }])
    expect(frame.startsWith(FRAME_MARKER)).toBe(true)
  })
})

describe('compileSnippet', () => {
  test('makes relative dynamic imports absolute and leaves bare ones alone', () => {
    const js = compileSnippet(`const a = await import('./x'); const b = await import('pkg'); a`, '/proj')
    expect(js).toContain('import("/proj/x")')
    expect(js).toContain('import("pkg")')
  })
})

describe('serialize', () => {
  test('tags what JSON loses', () => {
    expect(serialize(undefined)).toEqual({ t: 'undefined' })
    expect(serialize(10n)).toEqual({ t: 'bigint', v: '10' })
    expect(serialize(Number.NaN)).toEqual({ t: 'number', v: 'NaN' })
    expect(serialize(-0)).toEqual({ t: 'number', v: '-0' })
    expect(serialize(new Date(0))).toEqual({ t: 'date', v: '1970-01-01T00:00:00.000Z' })
    expect(serialize(/a/g)).toEqual({ t: 'regexp', v: '/a/g' })
    expect(serialize(new Map([['k', 1]]))).toEqual({ t: 'map', id: 1, size: 1, entries: [[{ t: 'string', v: 'k' }, { t: 'number', v: 1 }]] })
    expect(serialize(new Set([1]))).toEqual({ t: 'set', id: 1, size: 1, items: [{ t: 'number', v: 1 }] })
  })

  test('names class instances and marks cycles by id', () => {
    class Point { x = 1; self: unknown }
    const point = new Point()
    point.self = point
    expect(serialize(point)).toEqual({ t: 'object', id: 1, ctor: 'Point', entries: [['x', { t: 'number', v: 1 }], ['self', { t: 'ref', id: 1 }]] })
  })

  test('uses toJSON for an instance with no own fields', () => {
    class Rows { #rows = [1, 2]; toJSON() { return this.#rows } }
    expect(serialize(new Rows())).toMatchObject({ t: 'array', ctor: 'Rows', length: 2 })
  })

  test('records every cut instead of dropping silently', () => {
    expect(serialize('abcdef', { limits: { maxString: 2 } })).toEqual({ t: 'string', v: 'ab', truncated: 4 })
    expect(serialize([1, 2, 3], { limits: { maxItems: 1 } })).toMatchObject({ length: 3, more: 2 })
    expect(serialize({ a: { b: { c: 1 } } }, { limits: { maxDepth: 1 } })).toMatchObject({ entries: [['a', { t: 'cut', reason: 'depth' }]] })
  })

  test('describes errors with frames, cause and extra fields', () => {
    const error = Object.assign(new RangeError('bad', { cause: 'why' }), { code: 'E_BAD' })
    const described = serialize(error) as any
    expect(described).toMatchObject({ t: 'error', name: 'RangeError', message: 'bad', cause: { t: 'string', v: 'why' }, entries: [['code', { t: 'string', v: 'E_BAD' }]] })
    expect(described.frames.length).toBeGreaterThan(0)
  })

  test('lets a describer claim a value', () => {
    class Model { constructor(public attributes: Record<string, unknown>) {} }
    const described = serialize(new Model({ id: 1 }), {
      describers: [(value, describe) => value instanceof Model ? { t: 'object', id: 0, ctor: 'Model:User', entries: [['id', describe(value.attributes.id)]] } : undefined],
    })
    expect(described).toEqual({ t: 'object', id: 0, ctor: 'Model:User', entries: [['id', { t: 'number', v: 1 }]] })
  })
})

describe('models and previews', () => {
  // The shape a Stacks ORM instance has, without the ORM.
  function fakeUser(extra: Record<string, unknown> = {}) {
    const row: Record<string, unknown> = { id: 7, name: 'Ada', password: 'hash', ...extra }
    const loaded: Record<string, unknown> = {}
    const proto = {
      _definition: { name: 'User', table: 'users', primaryKey: 'id', hasMany: ['Post'], belongsTo: ['Team'], morphMany: { tokenable: 'PersonalAccessToken' } },
      getAttributes() { return row },
      getLoadedRelations() { return loaded },
      toJSON() { const { password: _hidden, ...visible } = row; return { ...visible, ...loaded } },
    }
    const user = Object.assign(Object.create(proto), row)
    return { user, loaded }
  }

  test('a model is described by name with hidden attributes named, not shown', () => {
    const { user } = fakeUser()
    expect(serialize(user)).toEqual({
      t: 'model',
      id: 1,
      model: 'User',
      table: 'users',
      primaryKey: 'id',
      key: { t: 'number', v: 7 },
      attributes: [['id', { t: 'number', v: 7 }], ['name', { t: 'string', v: 'Ada' }]],
      hidden: ['password'],
      relations: [
        { kind: 'hasMany', model: 'Post' },
        { kind: 'belongsTo', model: 'Team' },
        { kind: 'morphMany', model: 'PersonalAccessToken', name: 'tokenable' },
      ],
    })
    expect(JSON.stringify(serialize(user))).not.toContain('hash')
  })

  test('loaded relations are listed apart from attributes', () => {
    const { user, loaded } = fakeUser()
    loaded.posts = [{ title: 'One' }]
    const described = serialize(user) as any
    expect(described.attributes.map(([key]: [string]) => key)).toEqual(['id', 'name'])
    expect(described.loaded[0][0]).toBe('posts')
    expect(described.loaded[0][1]).toMatchObject({ t: 'array', length: 1 })
  })

  test('models in a list keep their shape', () => {
    const described = serialize([fakeUser().user, fakeUser({ id: 8 }).user]) as any
    expect(described.items.map((item: any) => [item.t, item.key.v])).toEqual([['model', 7], ['model', 8]])
  })

  test('relationsOf reads the array, object and named forms', () => {
    expect(relationsOf({ hasOne: ['Profile'], belongsToMany: [{ model: 'Role', relationName: 'roles' }], morphTo: 'Owner' })).toEqual([
      { kind: 'hasOne', model: 'Profile' },
      { kind: 'belongsToMany', model: 'Role', name: 'roles' },
      { kind: 'morphTo', model: 'Owner' },
    ])
  })

  test('a preview is markup to show, with its text part', () => {
    expect(serialize(new TinkerPreview('mail', '<p>Hi</p>', 'welcome', 'Hi'))).toEqual({ t: 'html', kind: 'mail', title: 'welcome', html: '<p>Hi</p>', text: 'Hi' })
  })

  test('the session offers preview.html and lists no models when bare', async () => {
    const { out } = await runSession(`
const s = await createTinkerSession({ boot: false })
const r = await s.evaluate("preview.html('<h1>x</h1>', 'Title')")
const frame = r.frames.find(f => f.type === 'result') as any
say({ value: frame.value, models: s.models() })`)
    expect(lines(out)[0]).toEqual({ value: { t: 'html', kind: 'html', title: 'Title', html: '<h1>x</h1>' }, models: [] })
  })
})
