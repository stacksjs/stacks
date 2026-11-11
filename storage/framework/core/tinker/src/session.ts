import type { SerializeOptions, TinkerErrorValue, TinkerValue } from './serialize'
import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { serialize, serializeThrown } from './serialize'

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
 */

export type TinkerFrame =
  | { type: 'stdout' | 'stderr', id: string, text: string }
  | { type: 'log', id: string, level: string, message: string, timestamp: string, context?: TinkerValue }
  | { type: 'query', id: string, sql: string, params?: TinkerValue, kind?: string, durationMs?: number, rowCount?: number, error?: string }
  | { type: 'dump', id: string, value: TinkerValue }
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

export interface TinkerSession {
  info: TinkerSessionInfo
  evaluate: (code: string, options?: { id?: string }) => Promise<TinkerEvaluation>
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
 */
export function compileSnippet(code: string, cwd: string, sourceName = 'tinker'): string {
  const transpiler = new Bun.Transpiler({ loader: 'ts', replMode: true } as ConstructorParameters<typeof Bun.Transpiler>[0])
  const compiled = transpiler.transformSync(code)
    .replace(RELATIVE_IMPORT, (_match, quote: string, specifier: string) => `import(${quote}${resolve(cwd, specifier)}${quote})`)
  return `${compiled}\n//# sourceURL=${sourceName}.ts`
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

  async function run(code: string, id: string): Promise<TinkerEvaluation> {
    const frames: TinkerFrame[] = []
    sink = frames
    currentId = id
    const started = performance.now()
    const elapsed = (): number => Math.round((performance.now() - started) * 100) / 100

    let compiled: string
    try {
      compiled = compileSnippet(code, cwd, `tinker-${id}`)
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
      emit({ type: 'result', id, value: serialize(value, serializeOptions), durationMs })
      emit({ type: 'done', id, ok: true })
      return { id, ok: true, value, frames, durationMs }
    }
    catch (thrown) {
      const durationMs = elapsed()
      if (thrown instanceof TinkerHalt) {
        emit({ type: 'result', id, value: { t: 'undefined' }, durationMs })
        emit({ type: 'done', id, ok: true })
        return { id, ok: true, frames, durationMs }
      }
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
    evaluate(code, evaluateOptions = {}) {
      const id = evaluateOptions.id ?? String(++counter)
      // One at a time: runs share globals and the capture's notion of "current".
      const next = queue.then(() => run(code, id))
      queue = next.catch(() => {})
      return next
    },
    dispose() {
      while (detach.length)
        detach.pop()?.()
    },
  }
}
