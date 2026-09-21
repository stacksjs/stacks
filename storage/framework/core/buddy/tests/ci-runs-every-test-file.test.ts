/**
 * Every test file in this repository is one CI runs on a pull request.
 *
 * A suite CI never reaches stays green whatever it would say, and nothing
 * reports that it is not running. Until f25e67af9d (2026-05-11) the test job
 * ran a bare `bun test` from the repository root, with no `[test] root` in
 * bunfig.toml, so it picked up test files across the checkout. Since then CI
 * has run the project's `tests/` through `buddy test`, one
 * `bun test ./<pkg>/tests` per core package, and a few paths named in ci.yml,
 * and nothing anywhere else. At d9822cae4d that left 162 tracked test files
 * unrun: 34 the bare `bun test` had picked up before f25e67af9d, and 128 added
 * after it that CI had never run.
 *
 * What CI runs is read from ci.yml rather than restated here, so both a new
 * test file outside every path CI covers and a workflow edit that stops
 * covering one fail this. A suite that cannot run in CI yet is exempted below
 * with the reason, and an exemption that is no longer needed fails too.
 *
 * A path is credited only when a failure there fails a pull request's CI:
 *
 * - The workflow has a `pull_request` trigger whose `branches` and
 *   `branches-ignore` admit main. A `types`, `paths` or `paths-ignore` filter
 *   on it is not evaluated, so nothing is credited under one.
 * - The job and the step run for that event. Each `if:` is evaluated with
 *   `github.event_name` `pull_request`, `github.ref` a `refs/pull/` ref,
 *   `github.base_ref` main, `success()` and `always()` true, `failure()` and
 *   `cancelled()` false, and every `steps.*.outcome`, `steps.*.conclusion`
 *   and `needs.*.result` `success`, the case in which a test step is what
 *   decides the job. A job also needs every job in its `needs:` to run, unless
 *   its `if:` calls `always()` or `cancelled()`.
 * - Neither the step nor its job sets `continue-on-error` to anything but
 *   false.
 * - The step runs under the default shell or `shell: bash`, and its script
 *   never runs `set +e`.
 * - In the script, a `bun test`, `bun run` or `buddy test` counts only where
 *   its exit status reaches the step: at the end of a command, before `;`, or
 *   before a `||` whose handler exits non-zero or records the failure in a
 *   variable (the per-package loop's `failed=...`; that the variable is
 *   checked later is taken on trust). Before `&&`, before any other `||`
 *   handler (`true`, `:`, `exit 0`, `echo`, ...), piped, or not last inside
 *   its `( ... )`, it counts for nothing.
 *
 * Any other name or function in a condition (`matrix`, `env`, `vars`,
 * `inputs`, `github.event.*`, `hashFiles()` ...) cannot be decided here, and
 * neither can a `shell:` other than bash: such a step credits nothing, and
 * "decides whether each test step runs" below names it. Shell control flow is
 * not evaluated at all: every line of a `run:` script is read as if it runs,
 * the body of an `if` or `case` included, and a `continue` or `exit` does not
 * end the reading.
 *
 * Paths are the arguments bun treats as paths, those with a leading `./`,
 * taken relative to the step's `working-directory` and any `cd` before them.
 * `for` loops over literal and glob words are unrolled, `bun run` is followed
 * into package.json, and a bare `buddy test` is resolved the way the runner
 * resolves it.
 */
import { describe, expect, it } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { resolveTestSuiteFilters } from '../../actions/src/test/runner'

const root = new URL('../../../../../', import.meta.url).pathname

/** What bun itself picks up as a test file. */
const TEST_FILE = /[._](?:test|spec)\.[cm]?[jt]sx?$/

/**
 * Test files CI does not run, each with why it cannot yet.
 *
 * A key ending in `/` covers everything under it. An entry here is a debt, not
 * a place to park a failing suite: the reason has to say what stops it running
 * in CI, so that whoever clears that knows to wire it in and delete the entry.
 */
const EXEMPT: Record<string, string> = {
  // On macOS's default volume `tests/browser` IS `tests/Browser`, so both
  // fixture files land in one directory the runner visits once, which is what
  // the test expects. On a case-sensitive volume, such as CI's Linux runner
  // has, they are two directories, and the runner rightly reports the second
  // file as `./tests/browser/timeline.spec.ts`. It can run once its
  // expectation follows the filesystem it runs on.
  'storage/framework/core/actions/src/test/runner.test.ts': 'it expects tests/Browser and tests/browser to be one directory, which holds only on a case-insensitive filesystem',
}

interface Step {
  'name'?: string
  'if'?: unknown
  'run'?: string
  'shell'?: string
  'continue-on-error'?: unknown
  'working-directory'?: string
}

interface Job {
  'if'?: unknown
  'needs'?: string | string[]
  'steps'?: Step[]
  'continue-on-error'?: unknown
  'defaults'?: { run?: { shell?: string } }
}

interface Workflow {
  on?: unknown
  jobs?: Record<string, Job>
  defaults?: { run?: { shell?: string } }
}

/** Whether something happens on a pull request: `undefined` when that cannot be decided here. */
interface Decision {
  runs: boolean | undefined
  why?: string
}

/** A step whose script hands `bun test` a path but earns no credit for it. */
interface Uncredited {
  step: string
  reason: string
  undecided: boolean
}

interface Reading {
  covered: Set<string>
  uncredited: Uncredited[]
}

/** What one step's script hands `bun test`, and what it hands it in a way that cannot fail the step. */
interface Findings {
  paths: Set<string>
  refused: string[]
}

function trackedTestFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(file => TEST_FILE.test(file))
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

const UNKNOWN = Symbol('cannot be decided here')
/** `github.ref` on a pull request: `refs/pull/<number>/merge`, number unknown. */
const PULL_REF = Symbol('refs/pull/')
type Value = string | number | boolean | null | typeof UNKNOWN | typeof PULL_REF

function truth(value: Value): boolean | undefined {
  if (value === UNKNOWN)
    return undefined
  return value === PULL_REF || Boolean(value)
}

function contextFor(name: string): Value {
  if (name === 'github.event_name')
    return 'pull_request'
  if (name === 'github.ref')
    return PULL_REF
  if (name === 'github.base_ref')
    return 'main'
  if (/^steps\.[\w-]+\.(?:outcome|conclusion)$/.test(name) || /^needs\.[\w-]+\.result$/.test(name))
    return 'success'
  return UNKNOWN
}

function compare(operator: string, left: Value, right: Value): Value {
  if ((operator !== '==' && operator !== '!=') || left === UNKNOWN || right === UNKNOWN)
    return UNKNOWN

  let equal: boolean
  if (left === PULL_REF || right === PULL_REF) {
    const other = left === PULL_REF ? right : left
    if (typeof other !== 'string' || other.toLowerCase().startsWith('refs/pull/'))
      return UNKNOWN
    equal = false
  }
  else if (typeof left === 'string' && typeof right === 'string') {
    // Actions compares strings ignoring case.
    equal = left.toLowerCase() === right.toLowerCase()
  }
  else if (typeof left === typeof right) {
    equal = left === right
  }
  else {
    return UNKNOWN
  }
  return operator === '==' ? equal : !equal
}

function both(left: boolean | undefined, right: boolean | undefined): Value {
  if (left === false || right === false)
    return false
  return left === true && right === true ? true : UNKNOWN
}

function either(left: boolean | undefined, right: boolean | undefined): Value {
  if (left === true || right === true)
    return true
  return left === false && right === false ? false : UNKNOWN
}

function call(name: string, args: Value[]): Value {
  switch (name.toLowerCase()) {
    case 'success':
    case 'always':
      return true
    case 'failure':
    case 'cancelled':
      return false
    case 'startswith':
    case 'endswith':
    case 'contains': {
      const [subject, search] = args
      if (typeof search !== 'string' || args.length !== 2)
        return UNKNOWN
      const needle = search.toLowerCase()
      if (subject === PULL_REF && name.toLowerCase() === 'startswith') {
        if ('refs/pull/'.startsWith(needle))
          return true
        return needle.startsWith('refs/pull/') ? UNKNOWN : false
      }
      if (typeof subject !== 'string')
        return UNKNOWN
      const haystack = subject.toLowerCase()
      if (name.toLowerCase() === 'startswith')
        return haystack.startsWith(needle)
      return name.toLowerCase() === 'endswith' ? haystack.endsWith(needle) : haystack.includes(needle)
    }
    default:
      return UNKNOWN
  }
}

/** An Actions expression's value on a pull request. Throws on syntax it does not know. */
function evaluate(expression: string): Value {
  const tokens: string[] = []
  const token = /\s*(?:'(?:[^']|'')*'|&&|\|\||[=!<>]=|[()!,<>]|-?\d+(?:\.\d+)?|[A-Z_][\w-]*(?:\.(?:[A-Z_][\w-]*|\*))*)/iy
  while (token.lastIndex < expression.length && expression.slice(token.lastIndex).trim()) {
    const at = token.lastIndex
    const match = token.exec(expression)
    if (!match)
      throw new Error(`cannot read \`${expression.slice(at)}\``)
    tokens.push(match[0].trim())
  }

  let at = 0
  const peek = (): string | undefined => tokens[at]
  const take = (expected?: string): string => {
    const next = tokens[at++]
    if (next === undefined || (expected !== undefined && next !== expected))
      throw new Error(`expected ${expected ?? 'more'} in \`${expression}\``)
    return next
  }

  const disjunction = (): Value => {
    let left = conjunction()
    while (peek() === '||') {
      take()
      left = either(truth(left), truth(conjunction()))
    }
    return left
  }
  const conjunction = (): Value => {
    let left = comparison()
    while (peek() === '&&') {
      take()
      left = both(truth(left), truth(comparison()))
    }
    return left
  }
  const comparison = (): Value => {
    let left = unary()
    while (/^[=!<>]=$|^[<>]$/.test(peek() ?? '')) {
      const operator = take()
      left = compare(operator, left, unary())
    }
    return left
  }
  const unary = (): Value => {
    if (peek() !== '!')
      return primary()
    take()
    const value = truth(unary())
    return value === undefined ? UNKNOWN : !value
  }
  const primary = (): Value => {
    const next = take()
    if (next === '(') {
      const value = disjunction()
      take(')')
      return value
    }
    if (next.startsWith('\''))
      return next.slice(1, -1).replace(/''/g, '\'')
    if (/^-?\d/.test(next))
      return Number(next)
    if (next === 'true' || next === 'false')
      return next === 'true'
    if (next === 'null')
      return null
    if (!/^[A-Z_]/i.test(next))
      throw new Error(`unexpected \`${next}\` in \`${expression}\``)
    if (peek() !== '(')
      return contextFor(next)
    take('(')
    const args: Value[] = []
    while (peek() !== ')') {
      args.push(disjunction())
      if (peek() === ',')
        take()
    }
    take(')')
    return call(next, args)
  }

  const value = disjunction()
  if (at !== tokens.length)
    throw new Error(`unexpected \`${tokens[at]}\` in \`${expression}\``)
  return value
}

/** An `if:` as the runner would decide it on a pull request. */
function decideIf(condition: unknown, what: string): Decision {
  if (condition === undefined || condition === null)
    return { runs: true }
  if (typeof condition === 'boolean')
    return condition ? { runs: true } : { runs: false, why: `its ${what} \`if:\` is false` }
  const text = String(condition).trim()
  const inner = /^\$\{\{([\s\S]*)\}\}$/.exec(text)?.[1] ?? text
  try {
    if (inner.includes('${{'))
      throw new Error('mixes text and expressions')
    const value = truth(evaluate(inner))
    if (value === undefined)
      return { runs: undefined, why: `its ${what} \`if: ${text}\` cannot be decided here` }
    return value ? { runs: true } : { runs: false, why: `its ${what} \`if: ${text}\` is false on a pull request` }
  }
  catch (error) {
    return { runs: undefined, why: `its ${what} \`if: ${text}\` cannot be read (${(error as Error).message})` }
  }
}

/** Whether `continue-on-error` leaves a failure able to fail the job. */
function decideContinueOnError(value: unknown, what: string): Decision {
  if (value === undefined || value === null || value === false || value === 'false')
    return { runs: true }
  if (value === true || value === 'true')
    return { runs: false, why: `its ${what} sets \`continue-on-error\`` }
  const decided = decideIf(value, what)
  if (decided.runs === undefined)
    return { runs: undefined, why: `its ${what} \`continue-on-error: ${String(value)}\` cannot be decided here` }
  return decided.runs ? { runs: false, why: `its ${what} sets \`continue-on-error\`` } : { runs: true }
}

/** The first decision that is not a plain yes: a no before an undecided one. */
function first(...decisions: Decision[]): Decision {
  return decisions.find(decision => decision.runs === false)
    ?? decisions.find(decision => decision.runs === undefined)
    ?? { runs: true }
}

/** Whether the workflow runs for a pull request against main. */
function decideTrigger(on: unknown): Decision {
  let events: Record<string, unknown>
  if (typeof on === 'string')
    events = { [on]: null }
  else if (Array.isArray(on))
    events = Object.fromEntries(on.map(event => [String(event), null]))
  else
    events = (on ?? {}) as Record<string, unknown>
  if (!('pull_request' in events))
    return { runs: false, why: 'the workflow has no pull_request trigger' }

  const filter = (events.pull_request ?? {}) as Record<string, unknown>
  const unread = ['types', 'paths', 'paths-ignore'].filter(key => key in filter)
  if (unread.length)
    return { runs: undefined, why: `its pull_request trigger filters on ${unread.join(', ')}, which this does not evaluate` }

  const list = (value: unknown): string[] | undefined => value === undefined ? undefined : [value].flat().map(String)
  const branches = list(filter.branches)
  const ignored = list(filter['branches-ignore'])
  if (ignored?.includes('main') || (branches && !branches.includes('main'))) {
    const patterned = [...(branches ?? []), ...(ignored ?? [])].some(branch => /[*?[!+]/.test(branch))
    return patterned
      ? { runs: undefined, why: 'its pull_request branch patterns cannot be decided here' }
      : { runs: false, why: 'its pull_request trigger does not admit main' }
  }
  if (ignored?.some(branch => /[*?[!+]/.test(branch)))
    return { runs: undefined, why: 'its pull_request branch patterns cannot be decided here' }
  return { runs: true }
}

// ---------------------------------------------------------------------------
// Scripts
// ---------------------------------------------------------------------------

/**
 * A shell word expanded the way bash would, relative to `cwd`: each `*`
 * segment against the directory it names. A word that matches nothing stays
 * as written, which is also what bash does.
 */
function expand(word: string, cwd: string): string[] {
  if (!word.includes('*'))
    return [word]

  let found = ['']
  for (const segment of word.split('/')) {
    if (!segment.includes('*')) {
      found = found.map(prefix => prefix ? `${prefix}/${segment}` : segment)
      continue
    }
    const pattern = new RegExp(`^${segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`)
    found = found.flatMap((prefix) => {
      const dir = join(root, cwd, prefix)
      if (!existsSync(dir))
        return []
      return readdirSync(dir)
        .filter(entry => !entry.startsWith('.') && pattern.test(entry))
        .sort()
        .map(entry => prefix ? `${prefix}/${entry}` : entry)
    })
  }
  found = found.filter(path => existsSync(join(root, cwd, path)))
  return found.length ? found : [word]
}

/** Logical lines of a `run:` script: comments dropped, continuations joined. */
function lines(script: string): string[] {
  return script
    .replace(/\\\n/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
}

function scriptsAt(dir: string): Record<string, string> {
  const manifest = join(root, dir, 'package.json')
  return existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).scripts ?? {} : {}
}

/**
 * The suites a bare `buddy test` runs: `Action.Test` is actions' test/index.ts,
 * whose `runTestSuites([...])` call names them, resolved by the same function
 * the runner uses.
 */
function buddyTestFiles(dir: string): string[] {
  const entry = readFileSync(join(root, 'storage/framework/core/actions/src/test/index.ts'), 'utf8')
  const call = /runTestSuites\(\[([^\]]*)\]/.exec(entry)
  if (!call)
    return []
  const suites = [...call[1]!.matchAll(/'([^']*)'/g)].map(match => match[1]!)
  return resolveTestSuiteFilters(join(root, dir), suites).map(file => normalize(join(dir, file)))
}

/**
 * Why a command's failure would not reach the step, or `undefined` when it
 * would. `parts` alternates commands and the operators between them, and
 * `index` is the command's own; `last` is whether it ends its `( ... )`.
 */
function swallowed(parts: string[], index: number, inSubshell: boolean, last: boolean): string | undefined {
  if (/(?:^|[^|])\|(?:[^|]|$)/.test(parts[index]!))
    return 'it is piped, and a pipeline\'s status is its last command\'s'
  if (inSubshell && !last)
    return 'it is not the last command in its `( ... )`, whose status is the last command\'s'

  const operator = parts[index + 1]
  if (operator === '&&')
    return 'it is followed by `&&`, and `bash -e` does not stop on a failure there'
  if (operator !== '||')
    return undefined
  const handler = (parts[index + 2] ?? '').trim().replace(/\)$/, '').trim()
  if (/^[A-Z_]\w*=/i.test(handler) || /^exit(?:\s+(?!0\b)\d+)?$/.test(handler))
    return undefined
  return `its failure goes to \`|| ${handler}\``
}

/**
 * What one shell command hands `bun test`, as repo-relative paths.
 *
 * Only an argument bun treats as a path counts, one with a leading `./`: from
 * the repo root a bare argument is a filter inside `[test] root = "tests"`.
 *
 * Returns the working directory the next command starts in: a `cd` inside a
 * `( ... )` subshell ends with it, and one outside it does not.
 */
function visitCommand(command: string, cwd: string, findings: Findings, depth: number): string {
  let outer = cwd
  let dir = cwd
  let subshell = false
  const parts = command.split(/(&&|\|\||;)/)
  for (let index = 0; index < parts.length; index += 2) {
    let segment = parts[index]!.trim()
    if (segment.startsWith('(')) {
      segment = segment.slice(1).trim()
      subshell = true
    }
    const closes = segment.endsWith(')') && !segment.includes('$(')
    if (closes)
      segment = segment.slice(0, -1).trim()

    const cd = /^cd\s+("?)([^"\s]+)\1$/.exec(segment)
    const script = /^bun run ([\w:.-]+)$/.exec(segment)
    const test = /^bun test(?:\s+(.*))?$/.exec(segment)
    const found: Findings = { paths: new Set(), refused: [] }

    if (cd) {
      dir = normalize(join(dir, cd[2]!))
      if (!subshell)
        outer = dir
    }
    else if (script && depth < 3) {
      const body = scriptsAt(dir)[script[1]!]
      if (body)
        visit(lines(body), dir, new Map(), found, depth + 1)
    }
    else if (/^(?:bun )?(?:\.\/)?buddy test$/.test(segment)) {
      for (const file of buddyTestFiles(dir))
        found.paths.add(file)
    }
    else if (test) {
      const args = (test[1] ?? '').split(/\s+/).map(arg => arg.replace(/^["']|["']$/g, ''))
      for (const arg of args) {
        if (!arg.startsWith('./') || arg.includes('$'))
          continue
        for (const path of expand(arg, dir))
          found.paths.add(normalize(join(dir, path)))
      }
    }

    findings.refused.push(...found.refused)
    if (found.paths.size) {
      const reason = swallowed(parts, index, subshell, closes)
      if (reason) {
        findings.refused.push(`\`${segment}\` credits nothing: ${reason}`)
      }
      else {
        for (const path of found.paths)
          findings.paths.add(path)
      }
    }

    if (closes && subshell) {
      dir = outer
      subshell = false
    }
  }
  return outer
}

/** Walks a script, unrolling each `for VAR in WORDS; do ... done` over its words. */
function visit(script: string[], start: string, vars: Map<string, string>, findings: Findings, depth = 0): void {
  const substitute = (text: string): string => text.replace(/\$\{?(\w+)\}?/g, (whole, name: string) => vars.get(name) ?? whole)

  let cwd = start
  for (let i = 0; i < script.length; i++) {
    const loop = /^for (\w+) in (.+?); do$/.exec(script[i]!)
    if (!loop) {
      cwd = visitCommand(substitute(script[i]!), cwd, findings, depth)
      continue
    }

    let end = i + 1
    for (let open = 1; end < script.length; end++) {
      if (/; do$|^do$/.test(script[end]!))
        open++
      else if (/^done\b/.test(script[end]!) && --open === 0)
        break
    }

    // A word list from a command substitution cannot be known here, and no
    // loop of that kind runs tests.
    const words = substitute(loop[2]!)
    if (!words.includes('$(')) {
      for (const value of words.split(/\s+/).flatMap(word => expand(word, cwd)))
        visit(script.slice(i + 1, end), cwd, new Map([...vars, [loop[1]!, value]]), findings, depth)
    }
    i = end
  }
}

/** Every path, file or directory, that a workflow's pull request run hands `bun test` in a way that can fail it. */
function readWorkflow(source: string): Reading {
  const workflow = (Bun.YAML.parse(source) ?? {}) as Workflow
  const jobs = workflow.jobs ?? {}
  const reading: Reading = { covered: new Set(), uncredited: [] }
  const trigger = decideTrigger(workflow.on)

  const decided = new Map<string, Decision>()
  const decideJob = (id: string, seen: string[] = []): Decision => {
    if (decided.has(id))
      return decided.get(id)!
    const job = jobs[id]
    if (!job || seen.includes(id))
      return { runs: undefined, why: `job \`${id}\` cannot be resolved` }
    const needs = [job.needs ?? []].flat()
    const outlivesSkips = /\b(?:always|cancelled)\s*\(/.test(String(job.if ?? ''))
    const needed = outlivesSkips
      ? { runs: true }
      : first(...needs.map((need) => {
          const decision = decideJob(need, [...seen, id])
          return decision.runs === true ? decision : { runs: decision.runs, why: `it needs \`${need}\`, and ${decision.why}` }
        }))
    const decision = first(decideIf(job.if, 'job\'s'), decideContinueOnError(job['continue-on-error'], 'job'), needed)
    decided.set(id, decision)
    return decision
  }

  for (const [id, job] of Object.entries(jobs)) {
    for (const [index, step] of (job.steps ?? []).entries()) {
      if (!step.run)
        continue
      const findings: Findings = { paths: new Set(), refused: [] }
      const script = lines(step.run)
      visit(script, normalize(step['working-directory'] ?? '.'), new Map(), findings)

      const where = `${id} › ${step.name ?? `step ${index + 1}`}`
      for (const reason of findings.refused)
        reading.uncredited.push({ step: where, reason, undecided: false })
      if (findings.paths.size === 0)
        continue

      const shell = step.shell ?? job.defaults?.run?.shell ?? workflow.defaults?.run?.shell
      const decision = first(
        trigger,
        decideJob(id),
        decideIf(step.if, 'step\'s'),
        decideContinueOnError(step['continue-on-error'], 'step'),
        script.some(line => /^set\s.*(?:\+\w*e|\+o\s+errexit)/.test(line))
          ? { runs: false, why: 'its script runs `set +e`' }
          : { runs: true },
        shell === undefined || shell === 'bash'
          ? { runs: true }
          : { runs: undefined, why: `it runs under \`shell: ${shell}\`, which this does not read` },
      )
      if (decision.runs === true) {
        for (const path of findings.paths)
          reading.covered.add(path)
      }
      else {
        reading.uncredited.push({ step: where, reason: decision.why!, undecided: decision.runs === undefined })
      }
    }
  }
  return reading
}

function isCovered(file: string, covered: Set<string>): boolean {
  if (covered.has(file))
    return true
  for (let dir = dirname(file); dir !== '.' && dir !== '/'; dir = dirname(dir)) {
    if (covered.has(dir))
      return true
  }
  return false
}

const exemptionFor = (file: string): string | undefined =>
  Object.keys(EXEMPT).find(key => key.endsWith('/') ? file.startsWith(key) : file === key)

const describeUncredited = ({ step, reason }: Uncredited): string => `${step}: ${reason}`

describe('CI test coverage', () => {
  const files = trackedTestFiles()
  const reading = readWorkflow(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8'))
  const covered = reading.covered

  it('reads what CI runs out of ci.yml', () => {
    // The two shapes everything else rests on, the per-package loop and
    // `buddy test`, so that a reading that finds nothing says so here rather
    // than as a wall of uncovered files below. Which paths CI must cover is
    // the next test's business, not this one's.
    expect(files.length).toBeGreaterThan(0)
    expect([...covered].some(path => /^storage\/framework\/core\/[^/]+\/tests$/.test(path))).toBe(true)
    expect(files.filter(file => file.startsWith('tests/')).every(file => covered.has(file))).toBe(true)
  })

  it('decides whether each test step runs', () => {
    expect(reading.uncredited.filter(entry => entry.undecided).map(describeUncredited)).toEqual([])
  })

  it('runs every test file, or says why it cannot', () => {
    const missing = new Map<string, number>()
    for (const file of files) {
      if (!isCovered(file, covered) && !exemptionFor(file))
        missing.set(dirname(file), (missing.get(dirname(file)) ?? 0) + 1)
    }

    const report = [...missing].map(([dir, count]) => `${dir}: ${count} test file(s) CI never runs`).sort()
    // Steps that run tests without being able to fail CI are why a path can
    // look wired and still land here, so they come with the list.
    if (report.length)
      report.push(...reading.uncredited.map(entry => `(not credited) ${describeUncredited(entry)}`))
    expect(report).toEqual([])
  })

  it('exempts only files that exist and that CI still skips', () => {
    const stale: string[] = []
    for (const key of Object.keys(EXEMPT)) {
      const matched = files.filter(file => exemptionFor(file) === key)
      if (matched.length === 0)
        stale.push(`${key}: no test file matches`)
      else if (matched.some(file => isCovered(file, covered)))
        stale.push(`${key}: CI runs it now, so the exemption can go`)
    }

    expect(stale).toEqual([])
  })
})

describe('reading a workflow', () => {
  const workflow = (jobs: string, on = 'pull_request:\n  branches: [main]'): string => `on:\n${on.replace(/^/gm, '  ')}\njobs:\n${jobs.replace(/^/gm, '  ')}\n`
  const covered = (source: string): string[] => [...readWorkflow(source).covered].sort()
  const undecided = (source: string): string[] => readWorkflow(source).uncredited.filter(entry => entry.undecided).map(entry => entry.step)

  it('credits paths relative to the step, a `cd` and a subshell', () => {
    expect(covered(workflow(`
t:
  steps:
    - run: bun test ./a
    - working-directory: pkg
      run: bun test ./b
    - run: |
        (cd pkg && bun test ./c) || failed="$failed c"
        bun test ./d || exit 1
        for x in e f; do
          bun test "./$x"
        done
`))).toEqual(['a', 'd', 'e', 'f', 'pkg/b', 'pkg/c'])
  })

  it('credits nothing from a job that does not run on a pull request', () => {
    const source = workflow(`
push-only:
  if: github.event_name == 'push'
  steps: [{ run: bun test ./push-only }]
main-or-dispatch:
  if: >-
    github.event_name == 'workflow_dispatch' ||
    (github.event_name == 'push' && github.ref == 'refs/heads/main')
  steps: [{ run: bun test ./main-or-dispatch }]
tags:
  if: startsWith(github.ref, 'refs/tags/')
  steps: [{ run: bun test ./tags }]
after-push-only:
  needs: push-only
  steps: [{ run: bun test ./after-push-only }]
always-after-push-only:
  needs: [push-only]
  if: \${{ always() }}
  steps: [{ run: bun test ./always-after-push-only }]
pull-request:
  if: github.event_name == 'pull_request' && github.base_ref == 'main'
  steps: [{ run: bun test ./pull-request }]
not-a-tag:
  if: \${{ !startsWith(github.ref, 'refs/tags/') }}
  steps: [{ run: bun test ./not-a-tag }]
`)
    expect(covered(source)).toEqual(['always-after-push-only', 'not-a-tag', 'pull-request'])
    expect(undecided(source)).toEqual([])
  })

  it('credits nothing when the workflow does not run for a pull request against main', () => {
    const job = 't:\n  steps: [{ run: bun test ./a }]'
    expect(covered(workflow(job, 'push:\n  branches: [main]'))).toEqual([])
    expect(covered(workflow(job, 'pull_request:\n  branches: [release]'))).toEqual([])
    expect(covered(workflow(job, 'pull_request:\n  branches-ignore: [main]'))).toEqual([])
    expect(covered(workflow(job, '[push, pull_request]'))).toEqual(['a'])
    expect(undecided(workflow(job, 'pull_request:\n  paths: [src/**]'))).toEqual(['t › step 1'])
  })

  it('credits a step behind the status and install checks ci.yml uses', () => {
    expect(covered(workflow(`
t:
  steps:
    - id: install
      run: bun install
    - if: \${{ !cancelled() && steps.install.outcome == 'success' }}
      run: bun test ./guarded
    - if: failure()
      run: bun test ./after-failure
    - if: false
      run: bun test ./never
`))).toEqual(['guarded'])
  })

  it('credits nothing from a step that cannot fail its job', () => {
    const source = workflow(`
t:
  steps:
    - continue-on-error: true
      run: bun test ./step-continues
    - run: bun test ./or-true || true
    - run: 'bun test ./or-colon || :'
    - run: bun test ./or-exit-zero || exit 0
    - run: bun test ./or-echo || echo failed
    - run: (cd pkg && bun test ./subshell-or-true) || true
    - run: (bun test ./not-last; echo done) || failed=1
    - run: bun test ./and-then && echo passed
    - run: bun test ./piped | tee out.log
    - run: |
        set +e
        bun test ./errexit-off
    - shell: bash
      run: bun test ./bash
lenient:
  continue-on-error: true
  steps: [{ run: bun test ./job-continues }]
`)
    expect(covered(source)).toEqual(['bash'])
    expect(undecided(source)).toEqual([])
  })

  it('names a condition it cannot decide instead of crediting it', () => {
    const source = workflow(`
matrix:
  if: matrix.os == 'ubuntu-latest'
  steps: [{ run: bun test ./matrix }]
t:
  steps:
    - if: contains(github.event.pull_request.labels.*.name, 'slow')
      run: bun test ./labels
    - continue-on-error: \${{ matrix.experimental }}
      run: bun test ./experimental
    - shell: sh
      run: bun test ./sh
    - if: hashFiles('**/bun.lock') != ''
      run: bun test ./hashed
`)
    expect(covered(source)).toEqual([])
    expect(undecided(source)).toEqual(['matrix › step 1', 't › step 1', 't › step 2', 't › step 3', 't › step 4'])
  })
})
