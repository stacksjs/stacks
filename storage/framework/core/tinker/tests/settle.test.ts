import { describe, expect, test } from 'bun:test'
import { compileSnippet } from '../src/session'
import { originalOffset, SETTLE_TYPE_WRAP, settledOffset, settleTopLevel, unsettleText } from '../src/settle'

// What a session provides for the rewritten code. Snippets are evaluated in
// this process: the rewrite and Bun's REPL transform are both pure, and none
// of these touch the console or the working directory.
const scope = globalThis as Record<string, unknown>
let held: unknown
scope.__tinkerPending = (value: unknown): boolean => {
  held = value
  return value instanceof Promise
}
scope.__tinkerTake = (): unknown => {
  const value = held
  held = undefined
  return value
}

const later = <T>(value: T, ms = 1): Promise<T> => new Promise(resolve => setTimeout(() => resolve(value), ms))
scope.later = later
/** Stands in for a model: a thenable builder whose terminals return promises. */
scope.Member = {
  where() {
    return this
  },
  orderByDesc() {
    return this
  },
  then(resolve: (value: string) => void) {
    resolve('the builder was awaited')
  },
  first: () => later({ email: 'ada@example.com', posts: () => later(['first post']) }),
  count: () => later(3),
  all: () => later([{ id: 1 }, { id: 2 }]),
  exists: () => later(false),
}

const globalEval = eval
let counter = 0
/** The outcome stays boxed: an async function that returned a thenable value bare would await it. */
async function outcomeOf(code: string, settle = true): Promise<{ value?: unknown }> {
  return await globalEval(compileSnippet(code, process.cwd(), `settle-test-${++counter}`, { settle })) as { value?: unknown }
}
async function run(code: string, settle = true): Promise<unknown> {
  return (await outcomeOf(code, settle)).value
}

const WRAPPED = /\(__tinkerPending\(|\) \? await __tinkerTake\(\) : __tinkerTake\(\)\)/g
/** The rewritten code with every wrap shown as brackets, which is easier to read in an assertion. */
const marked = (code: string): string => settleTopLevel(code, { wrap: { open: '«', close: '»' } }).code

describe('settling: a query needs no await at the top level', () => {
  test('a declaration binds the row, with or without await', async () => {
    const awaited = await run(`const one = await Member
.where('email', 'like', '%@example.com')
.orderByDesc('created_at')
.first()
one.email`)
    const bare = await run(`const two = Member
.where('email', 'like', '%@example.com')
.orderByDesc('created_at')
.first()
two.email`)
    expect(awaited).toBe('ada@example.com')
    expect(bare).toBe('ada@example.com')
  })

  test('the value of a line is the settled value', async () => {
    expect(await run('Member.count()')).toBe(3)
    expect(await run('later({ deep: later(1) }).deep')).toBe(1)
  })

  test('a promise is waited for where it stands, not only at the end of a statement', async () => {
    expect(await run('Member.first().email')).toBe('ada@example.com')
    expect(await run('Member.first().posts()')).toEqual(['first post'])
    expect(await run('Member.count() + 1')).toBe(4)
    expect(await run('`${Member.count()} members`')).toBe('3 members')
    expect(await run('[Member.count(), later("b")]')).toEqual([3, 'b'])
    expect(await run('{ members: Member.count(), first: Member.first().email }')).toEqual({ members: 3, first: 'ada@example.com' })
  })

  test('conditions and loops read the value, not the promise', async () => {
    expect(await run('Member.exists() ? "some" : "none"')).toBe('none')
    expect(await run('let branch = "unset"\nif (Member.exists()) branch = "yes"\nelse branch = "no"\nbranch')).toBe('no')
    expect(await run('const ids = []\nfor (const member of Member.all()) ids.push(member.id)\nids')).toEqual([1, 2])
    expect(await run('let turns = 0\nwhile (later(turns < 3)) turns++\nturns')).toBe(3)
    expect(await run('let matched = "none"\nswitch (later(2)) { case later(2): matched = "two" }\nmatched')).toBe('two')
  })

  test('assignments, destructuring and later statements see values', async () => {
    expect(await run('let reassigned\nreassigned = Member.count()\nreassigned * 2')).toBe(6)
    expect(await run('const { email } = Member.first()\nemail')).toBe('ada@example.com')
    expect(await run('const [x, y] = [later(1), later(2)]\nx + y')).toBe(3)
    expect(await run('const fallback = null ?? later("default")\nfallback')).toBe('default')
    expect(await run('const picked = later(true) ? later("yes") : later("no")\npicked')).toBe('yes')
  })

  test('a promise reached without a call is settled when a statement names it', async () => {
    expect(await run('const pending = [1, 2].map(n => later(n * 10))\npending[1]')).toBe(20)
    expect(await run('const kept = { job: null }\n;(() => { kept.job = later("done") })()\nconst job = kept.job\njob')).toBe('done')
  })

  test('a query builder stays a builder until a terminal is called', async () => {
    expect(await run('const query = Member.where("active", true)\ntypeof query.first')).toBe('function')
    expect((await outcomeOf('Member.where("active", true)')).value).toBe(scope.Member)
  })

  test('a rejection is thrown where the call stands', async () => {
    await expect(run('const never = later(1).then(() => { throw new Error("no such row") })\n"not reached"')).rejects.toThrow('no such row')
    expect(await run('let caught = "nothing"\ntry { later(1).then(() => { throw new Error("boom") }) }\ncatch (error) { caught = error.message }\ncaught')).toBe('boom')
  })
})

describe('settling leaves promise-handling code alone', () => {
  test('then, catch and finally keep their promise', async () => {
    expect(await run('later(2).then(value => value * 2)')).toBe(4)
    expect(await run('later(1).then(() => { throw new Error("x") }).catch(error => error.message)')).toBe('x')
    expect(marked('load().then(done)')).toBe(';«load().then(done)»')
  })

  test('the arguments of Promise.all and its siblings stay promises, so they still run together', async () => {
    const started = performance.now()
    expect(await run('const both = Promise.all([later("a", 40), later("b", 40)])\nboth')).toEqual(['a', 'b'])
    expect(performance.now() - started).toBeLessThan(75)
    expect(await run('const outcome = Promise.allSettled([later(1).then(() => { throw new Error("x") })])\noutcome[0].status')).toBe('rejected')
    expect(marked('Promise.race([slow(), fast()])')).toBe(';«Promise.race([slow(), fast()])»')
  })

  test('void means "do not wait"', async () => {
    expect(await run('let fired = "not yet"\nvoid later(1).then(() => { fired = "fired" })\nfired')).toBe('not yet')
    expect(marked('void start()')).toBe('void start()')
  })

  test('an explicit await is not awaited twice', () => {
    expect(marked('const row = await find(1)')).toBe('const row = await find(1)')
  })

  test('nothing inside a function, a class or an enum is touched', async () => {
    expect(marked('const load = async () => { const promise = fetchRow(); return promise }')).toBe('const load = async () => { const promise = fetchRow(); return promise }')
    expect(marked('function load() { return fetchRow() }')).toBe('function load() { return fetchRow() }')
    expect(marked('class Loader { rows = fetchRows(); static { warm() } load() { return fetchRow() } }')).toBe('class Loader { rows = fetchRows(); static { warm() } load() { return fetchRow() } }')
    expect(marked('enum Level { Low = level() }')).toBe('enum Level { Low = level() }')
    expect(await run('const inner = async () => later(1) instanceof Promise\ninner()')).toBe(true)
  })

  test('code with no promise in it runs in one turn, in order', async () => {
    // A microtask queued before the snippet must not get to run in the middle of it.
    scope.order = []
    queueMicrotask(() => (scope.order as string[]).push('microtask'))
    await run('order.push("first")\nconst doubled = [1, 2].map(n => n * 2)\norder.push(String(doubled.length))\norder.push("last")')
    expect((scope.order as string[]).slice(0, 3)).toEqual(['first', '2', 'last'])
  })

  test('settle: false leaves a promise a promise', async () => {
    expect(await run('const untouched = later(1)\nuntouched instanceof Promise', false)).toBe(true)
  })
})

describe('the rewrite', () => {
  test('wraps a multi-line chain without moving a line', () => {
    const code = `const user = User
.where('email', 'like', '%@example.com')
.orderByDesc('created_at')
.first()`
    const settled = settleTopLevel(code)
    expect(settled.code.split('\n').length).toBe(code.split('\n').length)
    expect(settled.code.replace(WRAPPED, '')).toBe(code)
    expect(marked(code)).toBe(`const user = «««User
.where('email', 'like', '%@example.com')»
.orderByDesc('created_at')»
.first()»`)
  })

  test('a statement that now opens with a parenthesis cannot join the line above', async () => {
    expect(marked('const total = 1\ncount()')).toBe('const total = 1\n;«count()»')
    expect(marked('if (ready) count()')).toBe('if (ready) «count()»')
    expect(await run('const base = 1\nlater(base + 1)')).toBe(2)
  })

  test('an optional chain is settled as a whole, and a settled value can start one', async () => {
    expect(marked('user?.posts().first')).toBe(';«user?.posts().first»')
    expect(marked('find(1)?.email')).toBe(';««find(1)»?.email»')
    expect(await run('const blank = { profile: null }\nblank.profile?.load().name')).toBeUndefined()
    expect(await run('later(null)?.email')).toBeUndefined()
  })

  test('reads TypeScript: type arguments, annotations, assertions', async () => {
    expect(marked('const tags: Map<string, number> = new Map<string, number>()')).toBe('const tags: Map<string, number> = «new Map<string, number>()»')
    expect(marked('const row = find<User>(1)!')).toBe('const row = «find<User>(1)»!')
    expect(await run('const typed = later(1) as unknown as number\ntyped + 1')).toBe(2)
    expect(await run('const lookup = new Map<string, number>([["a", 1]])\nlookup.get("a")')).toBe(1)
  })

  test('a snippet that opens with a brace is read as an object, as the REPL reads it', () => {
    expect(marked('{ members: count(), first: find(1) }')).toBe('{ members: «count()», first: «find(1)» }')
    expect(marked('{\n  count()\n}')).toBe('{\n  ;«count()»\n}')
  })

  test('a magic comment probe reports the settled value', () => {
    expect(marked('__tinkerProbe(0, (find(1)))')).toBe('__tinkerProbe(0, («find(1)»))')
    expect(marked('__tinkerProbe(2, (user.posts))')).toBe('__tinkerProbe(2, («user.posts»))')
  })

  test('code that does not parse comes back untouched, for the runtime to report', () => {
    expect(settleTopLevel('const = User.first(')).toEqual({ code: 'const = User.first(', edits: [] })
    expect(settleTopLevel('1 + 1')).toEqual({ code: '1 + 1', edits: [] })
  })

  test('offsets map both ways through the insertions', () => {
    const code = 'const user = User.first()\nuser.email'
    const { code: rewritten, edits } = settleTopLevel(code, { wrap: SETTLE_TYPE_WRAP })
    expect(rewritten).toBe('const user = __tinkerSettled(User.first())\n;__tinkerSettled(user.email)')
    const at = code.indexOf('email')
    expect(rewritten.slice(settledOffset(edits, at), settledOffset(edits, at) + 5)).toBe('email')
    expect(originalOffset(edits, rewritten.indexOf('email'))).toBe(at)
    expect(originalOffset(edits, rewritten.indexOf('__tinkerSettled') + 3)).toBe(code.indexOf('User'))
    expect(originalOffset(edits, 2)).toBe(2)
  })

  test('a message quoting rewritten code is shown as it was written', async () => {
    expect(unsettleText('evaluating \'(__tinkerPending(User.first()) ? await __tinkerTake() : __tinkerTake()).nope.deeper\'')).toBe('evaluating \'(User.first()).nope.deeper\'')
    expect(unsettleText('plain')).toBe('plain')
    const failure = await run('Member.first().nope.deeper').catch(error => unsettleText((error as Error).message))
    expect(failure).toContain('(Member.first()).nope.deeper')
    expect(failure).not.toContain('__tinker')
  })
})
