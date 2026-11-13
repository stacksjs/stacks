import type { SerializeOptions, TinkerErrorValue, TinkerValue } from './serialize'
import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { instrumentMagicComments } from './magic'
import { relationsOf, serialize, serializeThrown, TinkerPreview } from './serialize'
import { settleTopLevel, unsettleText } from './settle'

/**
 * A tinker session: one booted app, many evaluations, state kept between them.
 *
 * The old tinker wrote the snippet to a file in the project and ran a fresh
 * `bun` on it, so nothing survived from one run to the next, a snippet with
 * two statements was a syntax error, and the caller learned only an exit code.
 * A session evaluates in its own process instead. Declarations are hoisted to
 * globals by Bun's REPL transform, so `const user = await User.find(1)` in one
 * run is still `user` in the next, and each run reports what happened as
 * frames: output, logs, queries, dumps, then a typed result or an error.
 *
 * A promise at the top level of a snippet is waited for (see settle.ts), so
 * `const user = User.find(1)` binds the row as well: a query reads the way it
 * does in every other tinker tool, and `await` is only needed inside a
 * function.
 */

export type TinkerFrame =
  | { type: 'stdout' | 'stderr', id: string, text: string }
  | { type: 'log', id: string, level: string, message: string, timestamp: string, context?: TinkerValue }
  | { type: 'query', id: string, sql: string, params?: TinkerValue, kind?: string, durationMs?: number, rowCount?: number, error?: string }
  | { type: 'dump', id: string, value: TinkerValue }
  /** A magic comment's answer: the value at that line, or the milliseconds the run had taken when it got there. */
  | { type: 'probe', id: string, line: number, kind: 'value', value: TinkerValue }
  | { type: 'probe', id: string, line: number, kind: 'time', ms: number }
  | { type: 'result', id: string, value: TinkerValue, durationMs: number }
  | { type: 'error', id: string, error: TinkerErrorValue, phase: 'parse' | 'run', diagnostics?: TinkerDiagnostic[], durationMs: number }
  | { type: 'done', id: string, ok: boolean }

export interface TinkerDiagnostic {
  message: string
  line?: number
  column?: number
  lineText?: string
}

export interface TinkerSessionInfo {
  cwd: string
  /** Whether the Stacks app context (config overrides, models, framework globals) was booted. */
  booted: boolean
  bun: string
  /** What could not be loaded during boot. A session still starts without them. */
  warnings: string[]
}

export interface TinkerSessionOptions extends SerializeOptions {
  /** The project to run in. The process changes into it. Default: the current directory. */
  cwd?: string
  /**
   * Boot the Stacks app before the first evaluation: config overrides, then
   * models, jobs and framework helpers as globals. `false` gives a bare Bun
   * session (the sandbox). A function replaces the boot entirely, which is how
   * a driver for another kind of project plugs in. Default `true`.
   */
  boot?: boolean | (() => Promise<void> | void)
  /** Extra names to put on `globalThis` for the session. */
  globals?: Record<string, unknown>
  /** Turn magic comments into probe frames (see magic.ts). Default `true`. */
  magic?: boolean
  /**
   * Wait for promises at the top level of a snippet (see settle.ts), so a
   * query needs no `await` there. `false` leaves a promise a promise, as plain
   * JavaScript would. Default `true`.
   */
  settle?: boolean
  /** Receives every frame as it happens, for streaming. `evaluate` also returns them. */
  onFrame?: (frame: TinkerFrame) => void
}

export interface TinkerEvaluation {
  id: string
  ok: boolean
  /** The value of the last expression, when the run succeeded. Not serialized. */
  value?: unknown
  /** What was thrown, when it did not. */
  thrown?: unknown
  frames: TinkerFrame[]
  durationMs: number
}

/** One model the app knows, as a relation graph and a completion list need it. */
export interface TinkerModelSummary {
  name: string
  table?: string
  primaryKey?: string
  attributes: string[]
  relations: Array<{ kind: string, model: string, name?: string }>
}

/**
 * The models reachable as globals in this process. After a Stacks boot that
 * is every model the app loaded; in a bare session it is none.
 */
export function listModels(): TinkerModelSummary[] {
  const models: TinkerModelSummary[] = []
  const seen = new Set<string>()
  for (const name of Object.getOwnPropertyNames(globalThis)) {
    let candidate: unknown
    try {
      candidate = (globalThis as Record<string, unknown>)[name]
    }
    catch {
      continue
    }
    if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function'))
      continue
    const getDefinition = (candidate as { getDefinition?: unknown }).getDefinition
    if (typeof getDefinition !== 'function')
      continue
    let definition: Record<string, unknown> | undefined
    try {
      definition = getDefinition.call(candidate) as Record<string, unknown>
    }
    catch {
      continue
    }
    if (!definition || typeof definition.name !== 'string' || seen.has(definition.name))
      continue
    seen.add(definition.name)
    models.push({
      name: definition.name,
      ...(typeof definition.table === 'string' ? { table: definition.table } : {}),
      ...(typeof definition.primaryKey === 'string' ? { primaryKey: definition.primaryKey } : {}),
      attributes: definition.attributes && typeof definition.attributes === 'object' ? Object.keys(definition.attributes) : [],
      relations: relationsOf(definition),
    })
  }
  return models.sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * The `preview` global: turn a mail or markup into a value the result panel
 * shows as a rendered page.
 */
function previewHelpers(): Record<string, (...args: never[]) => unknown> {
  return {
    /** Show a string of HTML as a page. */
    html(html: string, title?: string): TinkerPreview {
      return new TinkerPreview('html', String(html), title)
    },
    /** Render a mail template from resources/emails by name, with its variables. */
    async mail(name: string, variables: Record<string, unknown> = {}): Promise<TinkerPreview> {
      const emailModule = '@stacksjs/email'
      const { templateByName } = await import(emailModule)
      const rendered = await templateByName(name, { variables }) as { html?: string, text?: string }
      if (!rendered?.html)
        throw new Error(`No mail template named "${name}" rendered. Templates live in resources/emails.`)
      return new TinkerPreview('mail', rendered.html, name, rendered.text)
    },
  } as Record<string, (...args: never[]) => unknown>
}

export interface TinkerEvaluateOptions {
  id?: string
  /** Overrides the session's `settle` for this run. */
  settle?: boolean
}

export interface TinkerSession {
  info: TinkerSessionInfo
  /** The models this session can see. */
  models: () => TinkerModelSummary[]
  evaluate: (code: string, options?: TinkerEvaluateOptions) => Promise<TinkerEvaluation>
  /** Detach the console, log and query capture. Globals the snippets declared stay. */
  dispose: () => void
}

/** Thrown by `dd()` to stop a run after dumping. It ends the run cleanly, not the process. */
class TinkerHalt extends Error {
  constructor() {
    super('dd')
    this.name = 'TinkerHalt'
  }
}

const RELATIVE_IMPORT = /\bimport\((["'])(\.{1,2}\/[^"']*)\1\)/g

/**
 * Compile a snippet into JavaScript that, evaluated at global scope, runs it
 * and yields `{ value }` for its last expression.
 *
 * Evaluated code has no file, so a relative `import('./app/Actions/Foo')`
 * would resolve against this package instead of the project. Those specifiers
 * are made absolute against the session's directory.
 *
 * With `settle`, promises at the snippet's top level are waited for. The
 * compiled code then calls `__tinkerPending` and `__tinkerTake`, which a
 * session provides.
 */
export function compileSnippet(code: string, cwd: string, sourceName = 'tinker', options: { settle?: boolean } = {}): string {
  const transpiler = new Bun.Transpiler({ loader: 'ts', replMode: true } as ConstructorParameters<typeof Bun.Transpiler>[0])
  const transform = (source: string): string => transpiler.transformSync(source)
    .replace(RELATIVE_IMPORT, (_match, quote: string, specifier: string) => `import(${quote}${resolve(cwd, specifier)}${quote})`)

  let compiled: string | undefined
  if (options.settle) {
    const settled = settleTopLevel(code)
    if (settled.edits.length) {
      try {
        compiled = transform(settled.code)
      }
      catch {
        // Whatever is wrong is reported against the code as it was written,
        // which is what the compile below does.
      }
    }
  }
  return `${compiled ?? transform(code)}\n//# sourceURL=${sourceName}.ts`
}

/** An engine quotes the code it was running in its message. Show the code as it was written. */
function restoreMessage(thrown: unknown): void {
  if (!(thrown instanceof Error) || !thrown.message.includes('__tinkerPending('))
    return
  try {
    thrown.message = unsettleText(thrown.message)
    if (typeof thrown.stack === 'string')
      thrown.stack = unsettleText(thrown.stack)
  }
  catch {
    // A frozen error keeps its message.
  }
}

function parseDiagnostics(thrown: unknown): TinkerDiagnostic[] {
  const list = thrown instanceof AggregateError
    ? thrown.errors
    : [thrown]
  const diagnostics: TinkerDiagnostic[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object')
      continue
    const message = (item as { message?: unknown }).message
    const position = (item as { position?: { line?: number, column?: number, lineText?: string } | null }).position
    diagnostics.push({
      message: typeof message === 'string' ? message : String(item),
      ...(position?.line !== undefined ? { line: position.line } : {}),
      ...(position?.column !== undefined ? { column: position.column } : {}),
      ...(position?.lineText ? { lineText: position.lineText } : {}),
    })
  }
  return diagnostics
}

async function bootStacks(warnings: string[]): Promise<boolean> {
  // Specifiers are held in variables so a bundler leaves them for the app's
  // own install to resolve: this package declares no framework dependency.
  const configModule = '@stacksjs/config'
  const serverModule = '@stacksjs/server'
  let booted = true
  try {
    const { overridesReady } = await import(configModule)
    await overridesReady
  }
  catch (error) {
    booted = false
    warnings.push(`config not loaded: ${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    const { injectGlobalAutoImports } = await import(serverModule)
    await injectGlobalAutoImports()
  }
  catch (error) {
    booted = false
    warnings.push(`models and framework globals not injected: ${error instanceof Error ? error.message : String(error)}`)
  }
  return booted
}

/** How long a snippet waits for work its model writes left running. */
const MODEL_WORK_LIMIT_MS = 5000
const CONSOLE_STDOUT = ['log', 'info', 'debug', 'dir', 'table'] as const
const CONSOLE_STDERR = ['warn', 'error', 'trace'] as const

export async function createTinkerSession(options: TinkerSessionOptions = {}): Promise<TinkerSession> {
  const cwd = options.cwd ? (isAbsolute(options.cwd) ? options.cwd : resolve(process.cwd(), options.cwd)) : process.cwd()
  if (cwd !== process.cwd())
    process.chdir(cwd)

  const serializeOptions: SerializeOptions = { limits: options.limits, describers: options.describers }
  const warnings: string[] = []
  const detach: Array<() => void> = []

  let currentId = 'boot'
  let sink: TinkerFrame[] | undefined
  const emit = (frame: TinkerFrame): void => {
    sink?.push(frame)
    try {
      options.onFrame?.(frame)
    }
    catch {
      // A listener that throws must not take the evaluation down with it.
    }
  }

  // Console and stream capture. Installed for the life of the session rather
  // than per run, so output from a timer or an unawaited promise that fires
  // after a run returned is still attributed (to the latest run) instead of
  // landing raw in the protocol stream.
  const consoleObject = console as unknown as Record<string, (...args: unknown[]) => void>
  const format = (args: unknown[]): string => args
    .map(arg => typeof arg === 'string' ? arg : Bun.inspect(arg, { depth: 6 }))
    .join(' ')
  for (const [methods, type] of [[CONSOLE_STDOUT, 'stdout'], [CONSOLE_STDERR, 'stderr']] as const) {
    for (const method of methods) {
      const original = consoleObject[method] as (...args: unknown[]) => void
      consoleObject[method] = (...args: unknown[]) => emit({ type, id: currentId, text: `${format(args)}\n` })
      detach.push(() => {
        consoleObject[method] = original
      })
    }
  }
  for (const [stream, type] of [[process.stdout, 'stdout'], [process.stderr, 'stderr']] as const) {
    const original = stream.write
    stream.write = ((chunk: unknown, ...rest: unknown[]): boolean => {
      emit({ type, id: currentId, text: typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString('utf8') })
      const callback = rest.find(arg => typeof arg === 'function') as (() => void) | undefined
      callback?.()
      return true
    }) as typeof stream.write
    detach.push(() => {
      stream.write = original
    })
  }

  const globals = globalThis as Record<string, unknown>
  globals.dump = (...args: unknown[]): void => {
    for (const arg of args)
      emit({ type: 'dump', id: currentId, value: serialize(arg, serializeOptions) })
  }
  globals.dd = (...args: unknown[]): never => {
    (globals.dump as (...inner: unknown[]) => void)(...args)
    throw new TinkerHalt()
  }
  globals.preview = previewHelpers()

  // What magic comments are rewritten into. A probe hands its value straight
  // back, so wrapping an expression in one changes nothing about the code.
  let runStarted = performance.now()
  globals.__tinkerProbe = (line: number, value: unknown, pick?: (value: unknown) => unknown): unknown => {
    const id = currentId
    const report = (shown: unknown): void => emit({ type: 'probe', id, line, kind: 'value', value: serialize(shown, serializeOptions) })
    if (!pick) {
      report(value)
      return value
    }
    try {
      const picked = pick(value)
      if (picked instanceof Promise)
        picked.then(report, error => report(error))
      else
        report(picked)
    }
    catch (error) {
      report(error)
    }
    return value
  }
  // What settle.ts rewrites a top-level expression into: keep the value, say
  // whether it is a promise, hand it back. The value is held only between the
  // two calls, which sit side by side in one expression.
  let held: unknown
  globals.__tinkerPending = (value: unknown): boolean => {
    held = value
    return value instanceof Promise
  }
  globals.__tinkerTake = (): unknown => {
    const value = held
    held = undefined
    return value
  }
  globals.__tinkerTime = (line: number, value?: unknown): unknown => {
    emit({ type: 'probe', id: currentId, line, kind: 'time', ms: Math.round((performance.now() - runStarted) * 100) / 100 })
    return value
  }
  if (options.globals)
    Object.assign(globals, options.globals)

  let booted = false
  if (typeof options.boot === 'function') {
    try {
      await options.boot()
      booted = true
    }
    catch (error) {
      warnings.push(`boot failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  else if (options.boot !== false) {
    booted = await bootStacks(warnings)
  }

  if (booted && options.boot !== false && typeof options.boot !== 'function') {
    // Boot puts the framework's own dump/dd on globalThis. The session's
    // versions report through frames and must not exit the process, so they
    // are put back after it.
    const sessionDump = (...args: unknown[]): void => {
      for (const arg of args)
        emit({ type: 'dump', id: currentId, value: serialize(arg, serializeOptions) })
    }
    globals.dump = sessionDump
    globals.dd = (...args: unknown[]): never => {
      sessionDump(...args)
      throw new TinkerHalt()
    }

    const loggingModule = '@stacksjs/logging'
    const queryModule = '@stacksjs/query-builder'
    try {
      const { registerTransport } = await import(loggingModule)
      detach.push(registerTransport({
        name: 'tinker',
        log(record: { level: string, message: string, timestamp: string, context?: unknown }) {
          emit({
            type: 'log',
            id: currentId,
            level: record.level,
            message: record.message,
            timestamp: record.timestamp,
            ...(record.context ? { context: serialize(record.context, serializeOptions) } : {}),
          })
        },
      }))
    }
    catch (error) {
      warnings.push(`log capture unavailable: ${error instanceof Error ? error.message : String(error)}`)
    }
    try {
      const { registerPersistentQueryHooks } = await import(queryModule)
      detach.push(registerPersistentQueryHooks({
        onQueryEnd(event: { sql: string, params?: unknown[], kind?: string, durationMs: number, rowCount?: number }) {
          emit({
            type: 'query',
            id: currentId,
            sql: event.sql,
            ...(event.params?.length ? { params: serialize(event.params, serializeOptions) } : {}),
            ...(event.kind ? { kind: event.kind } : {}),
            durationMs: event.durationMs,
            ...(event.rowCount !== undefined ? { rowCount: event.rowCount } : {}),
          })
        },
        onQueryError(event: { sql: string, params?: unknown[], kind?: string, durationMs: number, error: unknown }) {
          emit({
            type: 'query',
            id: currentId,
            sql: event.sql,
            ...(event.params?.length ? { params: serialize(event.params, serializeOptions) } : {}),
            ...(event.kind ? { kind: event.kind } : {}),
            durationMs: event.durationMs,
            error: event.error instanceof Error ? event.error.message : String(event.error),
          })
        },
      }))
    }
    catch (error) {
      warnings.push(`query capture unavailable: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Indirect eval runs at global scope, which is what makes the hoisted
  // `var` declarations of one snippet visible to the next.
  const globalEval = eval
  let counter = 0
  let queue: Promise<unknown> = Promise.resolve()

  /**
   * A model write answers before its search-index update and broadcast have
   * finished. A snippet is done when they are, so what they print belongs to
   * the snippet that caused them and a one-shot run does not exit under them.
   * The time is not the snippet's: `durationMs` is taken first. A failure was
   * logged where it happened, and an index that never answers must not hold
   * the session, hence the limit.
   */
  async function modelWorkSettled(): Promise<void> {
    const settled = (globalThis as unknown as Record<symbol, unknown>)[Symbol.for('stacks.orm.modelWorkSettled')]
    if (typeof settled !== 'function') return
    let limit: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      (settled as () => Promise<void>)().catch(() => {}),
      new Promise<void>((resolve) => { limit = setTimeout(resolve, MODEL_WORK_LIMIT_MS) }),
    ])
    clearTimeout(limit)
  }

  async function run(code: string, id: string, settle: boolean): Promise<TinkerEvaluation> {
    const frames: TinkerFrame[] = []
    sink = frames
    currentId = id
    const started = performance.now()
    runStarted = started
    const elapsed = (): number => Math.round((performance.now() - started) * 100) / 100

    let compiled: string
    try {
      compiled = compileSnippet(options.magic === false ? code : instrumentMagicComments(code).code, cwd, `tinker-${id}`, { settle })
    }
    catch (thrown) {
      const durationMs = elapsed()
      emit({ type: 'error', id, phase: 'parse', error: serializeThrown(thrown, serializeOptions), diagnostics: parseDiagnostics(thrown), durationMs })
      emit({ type: 'done', id, ok: false })
      sink = undefined
      return { id, ok: false, thrown, frames, durationMs }
    }

    try {
      const outcome = await globalEval(compiled) as { value?: unknown } | undefined
      const value = outcome?.value
      const durationMs = elapsed()
      await modelWorkSettled()
      emit({ type: 'result', id, value: serialize(value, serializeOptions), durationMs })
      emit({ type: 'done', id, ok: true })
      return { id, ok: true, value, frames, durationMs }
    }
    catch (thrown) {
      const durationMs = elapsed()
      held = undefined
      if (thrown instanceof TinkerHalt) {
        emit({ type: 'result', id, value: { t: 'undefined' }, durationMs })
        emit({ type: 'done', id, ok: true })
        return { id, ok: true, frames, durationMs }
      }
      restoreMessage(thrown)
      emit({ type: 'error', id, phase: 'run', error: serializeThrown(thrown, serializeOptions), durationMs })
      emit({ type: 'done', id, ok: false })
      return { id, ok: false, thrown, frames, durationMs }
    }
    finally {
      sink = undefined
    }
  }

  return {
    info: { cwd, booted, bun: Bun.version, warnings },
    models: listModels,
    evaluate(code, evaluateOptions = {}) {
      const id = evaluateOptions.id ?? String(++counter)
      // One at a time: runs share globals and the capture's notion of "current".
      const next = queue.then(() => run(code, id, evaluateOptions.settle ?? options.settle !== false))
      queue = next.catch(() => {})
      return next
    },
    dispose() {
      while (detach.length)
        detach.pop()?.()
    },
  }
}
