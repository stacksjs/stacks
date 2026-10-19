/**
 * Run a test file or script in its own Bun process.
 *
 * `bun test` runs every file in one process, and some state outlives the file
 * that set it: `mock.module()` replaces a module for the rest of the run, so a
 * mock in one file leaks into the next one that imports the real thing; a
 * framework booted against one database stays booted against it; a global set
 * by a preload stays set. When a test needs a clean process (its own env, its
 * own database, the real module), run it in a child.
 *
 * The child is killed when `timeoutMs` passes (SIGTERM, then SIGKILL after a
 * short grace), so a hung child fails the test with its output instead of
 * hanging the run. Nothing here depends on the framework, so it is safe to
 * import from any test.
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

export interface RunIsolatedOptions {
  /**
   * Variables for the child, over the parent's environment (or over nothing
   * when `inheritEnv` is false). `undefined` removes a variable.
   */
  env?: Record<string, string | undefined>

  /** Start from the parent's environment. Default true. */
  inheritEnv?: boolean

  /** Kill the child after this long. Default 60 000 ms. */
  timeoutMs?: number

  /** Arguments after the file: `bun test` flags, or the script's own argv. */
  args?: string[]

  /** Working directory of the child. Default the parent's. */
  cwd?: string

  /**
   * `'test'` runs the file with `bun test`, `'run'` as a script. `'auto'`
   * (the default) picks `'test'` for `*.test.*` and `*.spec.*` files.
   */
  mode?: 'auto' | 'test' | 'run'

  /**
   * Replace the project's `bunfig.toml` preloads with these (an empty list
   * means none), by pointing the child at a generated config. Leave it out to
   * keep the project's bunfig as it is. Not with `bunfig`: put the preloads
   * in that file instead.
   */
  preload?: string[]

  /**
   * Run the child with this bunfig instead of the project's (`--config=`),
   * for a suite that keeps its own (`tests/isolated/bunfig.toml`). A relative
   * path is resolved against `cwd`. Leave it out to keep the project's.
   */
  bunfig?: string

  /** Read `.env` files as Bun normally does. Default true; false passes `--no-env-file`. */
  envFile?: boolean

  /** Text written to the child's stdin, then closed. */
  stdin?: string
}

export interface IsolatedResult {
  /** The exit code, or null when the child was killed by a signal. */
  code: number | null
  signal: string | null
  stdout: string
  stderr: string
  /** The watchdog killed the child. */
  timedOut: boolean
  durationMs: number
  /** The command that ran, for messages. */
  command: string[]
}

const GRACE_MS = 2_000

/** The full Bun command line `runIsolated` would spawn for these options. */
export function isolatedCommand(file: string, options: Pick<RunIsolatedOptions, 'mode' | 'args' | 'envFile'> & { config?: string } = {}): string[] {
  const mode = options.mode && options.mode !== 'auto'
    ? options.mode
    : /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) ? 'test' : 'run'
  return [
    process.execPath,
    ...(options.config ? [`--config=${options.config}`] : []),
    ...(options.envFile === false ? ['--no-env-file'] : []),
    ...(mode === 'test' ? ['test'] : []),
    file,
    ...(options.args ?? []),
  ]
}

function childEnv(options: RunIsolatedOptions): Record<string, string> {
  const env: Record<string, string | undefined> = options.inheritEnv === false ? {} : { ...process.env }
  for (const [key, value] of Object.entries(options.env ?? {})) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }
  return Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined))
}

/**
 * Run `file` in a fresh Bun process and collect what it printed.
 *
 * @example
 * const result = await runIsolated('tests/fixtures/billing-flow.ts', {
 *   env: { APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: path },
 *   timeoutMs: 45_000,
 * })
 * expect(result.code, result.stdout + result.stderr).toBe(0)
 */
export async function runIsolated(file: string, options: RunIsolatedOptions = {}): Promise<IsolatedResult> {
  if (!file || typeof file !== 'string') throw new TypeError('runIsolated needs a file to run')
  const timeoutMs = options.timeoutMs ?? 60_000
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('timeoutMs must be a positive number of milliseconds')

  if (options.bunfig != null && options.preload) throw new TypeError('runIsolated takes bunfig or preload, not both: list the preloads in that bunfig')
  let configDir: string | null = null
  let config: string | undefined
  if (options.bunfig != null) {
    if (!options.bunfig) throw new TypeError('bunfig must be a path to a bunfig.toml')
    config = resolve(options.cwd ?? process.cwd(), options.bunfig)
    if (!existsSync(config)) throw new Error(`runIsolated: no bunfig at ${config}`)
  }
  if (options.preload) {
    configDir = mkdtempSync(join(tmpdir(), 'stacks-isolated-'))
    // A config with no preload at all falls back to Bun's defaults, so an
    // empty list is spelled as one module that does nothing.
    const noop = join(configDir, 'noop-preload.ts')
    writeFileSync(noop, 'export {}\n')
    const list = JSON.stringify(options.preload.length ? options.preload : [noop])
    config = join(configDir, 'bunfig.toml')
    writeFileSync(config, `preload = ${list}\n\n[test]\npreload = ${list}\n`)
  }

  const command = isolatedCommand(file, { ...options, config })
  const started = Date.now()
  let timedOut = false
  try {
    const child = Bun.spawn(command, {
      cwd: options.cwd,
      env: childEnv(options),
      stdin: options.stdin != null ? new Blob([options.stdin]) : 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    let killer: ReturnType<typeof setTimeout> | undefined
    const watchdog = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      killer = setTimeout(() => child.kill('SIGKILL'), GRACE_MS)
    }, timeoutMs)
    try {
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      return {
        code: child.signalCode ? null : code,
        signal: child.signalCode == null ? null : String(child.signalCode),
        stdout,
        stderr,
        timedOut,
        durationMs: Date.now() - started,
        command,
      }
    }
    finally {
      clearTimeout(watchdog)
      clearTimeout(killer)
      if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL')
    }
  }
  finally {
    if (configDir) rmSync(configDir, { recursive: true, force: true })
  }
}

/**
 * Throw, with everything the child printed, unless it exited 0 (and printed
 * `expect` to stdout, when given). Returns the result for further checks.
 *
 * @example
 * assertIsolatedOk(await runIsolated('tests/fixtures/flow.ts'), 'flow OK')
 */
export function assertIsolatedOk(result: IsolatedResult, expect?: string | RegExp): IsolatedResult {
  const printed = `\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
  if (result.timedOut)
    throw new Error(`${result.command.slice(1).join(' ')} timed out after ${result.durationMs}ms${printed}`)
  if (result.code !== 0)
    throw new Error(`${result.command.slice(1).join(' ')} exited ${result.code ?? result.signal}${printed}`)
  if (expect != null && !(typeof expect === 'string' ? result.stdout.includes(expect) : expect.test(result.stdout)))
    throw new Error(`${result.command.slice(1).join(' ')} did not print ${String(expect)}${printed}`)
  return result
}
