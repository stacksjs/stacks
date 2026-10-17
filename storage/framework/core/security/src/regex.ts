import { devNull } from 'node:os'

export interface BoundedRegexOptions {
  flags?: string
  /** Includes starting the isolated Bun process. Defaults to 25ms, at most 1000ms. */
  timeoutMs?: number
}

export interface BoundedRegexMatch {
  value: string
  index: number
}

export class RegexTimeoutError extends Error {
  constructor() {
    super('Regular expression exceeded its execution budget')
    this.name = 'RegexTimeoutError'
  }
}

// Only this fixed program executes. Pattern and subject travel over stdin, never
// through source interpolation, the command line, environment or diagnostics.
const MATCH_PROGRAM = `
const { source, flags, input } = JSON.parse(await Bun.stdin.text());
try {
  const match = new RegExp(source, flags).exec(input);
  console.log(JSON.stringify({ match: match ? { value: match[0], index: match.index } : null }));
} catch {
  console.log(JSON.stringify({ invalid: true }));
}
`

/**
 * Match an untrusted expression with an enforced process deadline.
 *
 * Use ordinary RegExp for trusted application constants. A synchronous engine
 * match cannot be interrupted by a JavaScript timer, and Bun worker/vm shutdown
 * may wait for a running regex. A separate process can be killed by the OS.
 * This deliberately pays process startup cost on every untrusted match rather
 * than trusting a sample input to certify every future subject.
 *
 * Failure throws: a failed security check must not look like a clean non-match.
 * Matching is stateless and returns the first complete match, without captures.
 * Source is capped at 8Ki UTF-16 code units and input at 64Ki.
 */
export function matchBoundedRegex(source: string, input: string, options: BoundedRegexOptions = {}): BoundedRegexMatch | null {
  const timeoutMs = options.timeoutMs ?? 25
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 1000)
    throw new RangeError('Regex timeout must be an integer between 1 and 1000 milliseconds')
  if (typeof source !== 'string' || source.length > 8192 || typeof input !== 'string' || input.length > 65536)
    throw new RangeError('Regex source or input exceeds its size limit')
  if (options.flags !== undefined && typeof options.flags !== 'string')
    throw new TypeError('Regex flags must be a string')
  if (options.flags !== undefined && options.flags.length > 8)
    throw new SyntaxError('Invalid regular expression flags')

  const executable = Bun.which('bun')
  if (!executable)
    throw new Error('Bounded regex matching requires the Bun executable on PATH')

  const result = Bun.spawnSync([executable, `--config=${devNull}`, '--no-env-file', '--no-install', '--eval', MATCH_PROGRAM], {
    // Do not inherit project preloads, .env files, BUN_OPTIONS or credentials.
    env: {},
    stdin: Buffer.from(JSON.stringify({ source, flags: options.flags ?? '', input })),
    stdout: 'pipe',
    stderr: 'ignore',
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
    maxBuffer: 512 * 1024,
  })

  if (result.signalCode === 'SIGKILL')
    throw new RegexTimeoutError()
  if (result.exitCode !== 0)
    throw new Error('Isolated regex execution failed')

  const response: { invalid?: boolean, match?: BoundedRegexMatch | null } = JSON.parse(result.stdout.toString())
  if (response.invalid)
    throw new SyntaxError('Invalid regular expression')
  if (response.match === null)
    return null
  if (!response.match || typeof response.match.value !== 'string' || !Number.isInteger(response.match.index))
    throw new Error('Invalid isolated regex response')
  return response.match
}
