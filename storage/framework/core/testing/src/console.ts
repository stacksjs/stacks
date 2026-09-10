import process from 'node:process'

/**
 * Running a buddy command in a test (stacksjs/stacks#2581).
 *
 * Documented in `docs/testing/console-tests.md` and never implemented. The
 * documentation also had its shape wrong: it imported `withInput` and
 * `withEnv` as free functions when the samples used them as chained calls on
 * the result of `command()`. They are methods, and this is the builder they
 * hang off.
 *
 * The command runs in a CHILD PROCESS rather than in-process. A buddy command
 * writes real files on startup - `storage/framework/runtime`, `storage/cloud` -
 * and calls `process.exit`, so running one inside the test runner would leave
 * that state behind and could take the runner down with it. A child process
 * gets its own exit code and its own mess.
 */

/** What a finished command produced. */
export interface CommandResult {
  exitCode: number
  /** stdout and stderr interleaved, which is what a person reading a terminal sees. */
  output: string
  stdout: string
  stderr: string
  /** Whether {@link CommandBuilder.withTimeout} cut it short. */
  timedOut: boolean
}

/** A command that has not run yet. Awaiting it runs it. */
export interface CommandBuilder extends PromiseLike<CommandResult> {
  /** Lines fed to the command's stdin, one per prompt. */
  withInput: (lines: readonly string[]) => CommandBuilder
  /** Environment added to (not replacing) the parent's. */
  withEnv: (env: Record<string, string>) => CommandBuilder
  /** Working directory. Defaults to the project root. */
  withCwd: (cwd: string) => CommandBuilder
  /** Give up after this many milliseconds. Defaults to 60s. */
  withTimeout: (ms: number) => CommandBuilder
}

const DEFAULT_TIMEOUT_MS = 60_000

/**
 * Split a command string the way a shell would, honouring quotes.
 *
 * `command('make:model Post --migration')` is the documented form, so the
 * string has to become argv somewhere. Quoted arguments matter as soon as
 * anything takes a message: `command('commit -m "two words"')` is otherwise
 * three arguments and a broken test.
 */
export function splitCommand(input: string): string[] {
  const args: string[] = []
  let current = ''
  let quote: '"' | '\'' | null = null
  let escaped = false
  let started = false

  for (const char of input) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      started = true
      continue
    }
    if (quote) {
      if (char === quote)
        quote = null
      else
        current += char
      continue
    }
    if (char === '"' || char === '\'') {
      quote = char
      started = true
      continue
    }
    if (/\s/.test(char)) {
      if (started) {
        args.push(current)
        current = ''
        started = false
      }
      continue
    }
    current += char
    started = true
  }

  if (quote)
    throw new Error(`Unterminated ${quote} in command: ${input}`)
  if (started)
    args.push(current)

  return args
}

/**
 * Run a buddy command and capture what it did.
 *
 * @example
 * ```ts
 * const result = await command('greet John --loud')
 * expect(result.exitCode).toBe(0)
 * expect(result.output).toContain('HELLO, JOHN!')
 * ```
 *
 * @example Answering a prompt
 * ```ts
 * const result = await command('db:drop').withInput(['yes'])
 * ```
 */
export function command(input: string | readonly string[]): CommandBuilder {
  const args = typeof input === 'string' ? splitCommand(input) : [...input]

  let stdin: string | undefined
  let env: Record<string, string> = {}
  let cwd = process.cwd()
  let timeoutMs = DEFAULT_TIMEOUT_MS

  async function run(): Promise<CommandResult> {
    if (args.length === 0)
      throw new Error('command() needs something to run')

    const proc = Bun.spawn(['./buddy', ...args], {
      cwd,
      // Added to the parent's rather than replacing it: a command needs PATH,
      // HOME and the rest to run at all.
      env: { ...process.env, ...env },
      stdin: stdin === undefined ? 'ignore' : new TextEncoder().encode(stdin),
      stdout: 'pipe',
      stderr: 'pipe',
    })

    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill()
    }, timeoutMs)

    try {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ])

      return { exitCode, stdout, stderr, output: stdout + stderr, timedOut }
    }
    finally {
      clearTimeout(timer)
    }
  }

  const builder: CommandBuilder = {
    withInput(lines) {
      // A trailing newline per line, because a prompt reads a line and would
      // otherwise wait forever for the last one to be terminated.
      stdin = lines.map(line => `${line}\n`).join('')
      return builder
    },
    withEnv(next) {
      env = { ...env, ...next }
      return builder
    },
    withCwd(next) {
      cwd = next
      return builder
    },
    withTimeout(ms) {
      if (!Number.isFinite(ms) || ms <= 0)
        throw new TypeError(`withTimeout expects a positive number of milliseconds, got ${ms}`)
      timeoutMs = ms
      return builder
    },
    // Thenable rather than a promise, so nothing runs until it is awaited and
    // the chained calls above have all been applied.
    then(onFulfilled, onRejected) {
      return run().then(onFulfilled, onRejected)
    },
  }

  return builder
}
