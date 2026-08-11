/**
 * Strip the framework's own CI from a project that no longer vendors it.
 *
 * `buddy new` scaffolds a project that IS the framework — the whole source under
 * `storage/framework/core`, and a CI file with jobs that build every package,
 * run every package's tests, and compile the CLI binary. `unpublish:core --all`
 * removes that directory, and those jobs then fail by construction: a loop over
 * the per-package test directories has nothing to expand, so the glob is passed
 * through literally and the job reports `Failing core packages: *` — an
 * unexpanded asterisk, printed as if it were the name of a package.
 *
 * Nobody connects that to an unvendor that happened weeks earlier, so the
 * pipeline just stays red, and a red pipeline says nothing about the change that
 * just landed. One project ran that way for its entire history.
 *
 * Line-based rather than parse-and-reserialize: a workflow is full of comments
 * explaining why each job exists, and a YAML round trip drops every one of them.
 */

/** A workflow edit, for the summary the command prints. */
export interface WorkflowPrune {
  file: string
  removedJobs: string[]
  removedSteps: number
}

/**
 * Paths that only exist while the framework is vendored.
 *
 * `storage/framework/core` is the source tree itself. `scripts/publish-commit`
 * is the framework's own npm publish, which walks that tree — it survives the
 * unvendor as a file and finds nothing, so the job that runs it either publishes
 * nothing or fails, depending on how far it gets.
 */
const FRAMEWORK_ONLY_PATH = /storage\/framework\/(?:core|scripts\/publish-commit)/

/**
 * Commands that check the FRAMEWORK's own generated output.
 *
 * These leave no trace in a workflow line — `bun run docs:artifacts:check` names
 * a script that names a buddy command — so the path rule above cannot see them,
 * and the job that runs them fails in an app with nothing to point at. They are
 * listed rather than detected because the knowledge is genuinely the
 * framework's: `commands/docs.ts` opens by calling itself framework-repo
 * tooling, and that sentence was the only place it was written down.
 *
 * A list like this is exactly the kind that rots, so a test pins every entry
 * against the framework's own package.json — a rename fails there rather than
 * quietly leaving a job behind for the next app to trip over.
 *
 * `release` and `test:types` are deliberately NOT here. An app can repurpose
 * either, and silently deleting somebody's release pipeline is a much worse
 * mistake than leaving a job they can delete themselves.
 */
const FRAMEWORK_ONLY_SCRIPTS = new Set([
  'docs:buddy',
  'docs:buddy:check',
  'docs:artifacts',
  'docs:artifacts:check',
  'docs:links',
  'docs:links:check',
])

/** Every script or buddy command a line invokes. */
function invocations(line: string): string[] {
  return [...line.matchAll(/(?:bun\s+run|bun\s+buddy|\.\/buddy|bunx?\s+buddy)\s+["']?([\w:.-]+)/g)].map(match => match[1]!)
}

/**
 * Does this line run work that only exists while the framework is vendored —
 * rather than merely mention it in prose?
 */
function referencesCore(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.startsWith('#'))
    return false

  const code = line.replace(/\s#.*$/, '')

  return FRAMEWORK_ONLY_PATH.test(code) || invocations(code).some(name => FRAMEWORK_ONLY_SCRIPTS.has(name))
}

/** The framework-repo scripts this prunes, so a test can pin them. */
export const frameworkOnlyScripts: readonly string[] = [...FRAMEWORK_ONLY_SCRIPTS]

/** The line index each top-level job starts at, in order. */
function jobStarts(lines: string[]): { name: string, at: number }[] {
  const out: { name: string, at: number }[] = []
  let inJobs = false

  for (const [at, line] of lines.entries()) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true
      continue
    }
    if (!inJobs)
      continue
    // Any other top-level key ends the jobs block.
    if (/^\S/.test(line) && !/^\s*#/.test(line))
      break

    const match = line.match(/^ {2}([A-Za-z_][\w-]*):\s*$/)
    if (match)
      out.push({ name: match[1]!, at })
  }

  return out
}

/** Where `from` ends: the next sibling at the same indent, or the end. */
function blockEnd(lines: string[], from: number, indent: number): number {
  const sibling = new RegExp(`^ {${indent}}(?:- |[A-Za-z_"'])`)

  for (let at = from + 1; at < lines.length; at++) {
    const line = lines[at]!
    if (line.trim() === '')
      continue
    const leading = line.length - line.trimStart().length
    if (leading < indent)
      return at
    if (leading === indent && sibling.test(line))
      return at
  }

  return lines.length
}

/**
 * Steps that only get a runner ready: checkout, cache, toolchain, install.
 *
 * They are not why a job exists. A job whose every REAL step ran against the
 * vendored core is left, once those are removed, checking out a repository and
 * installing its dependencies to assert nothing — several minutes of runner
 * time and a green tick that means nothing at all.
 */
const SETUP_STEP = [
  /uses:\s*actions\/checkout/,
  /uses:\s*actions\/cache/,
  /uses:\s*actions\/setup-/,
  /uses:\s*pantry-pm\/pantry/,
  /run:\s*(?:bun|pantry|npm|pnpm|yarn)\s+(?:install|ci)\b/,
]

function isSetupStep(step: string[]): boolean {
  const code = step.filter(line => !line.trim().startsWith('#'))

  return SETUP_STEP.some(pattern => code.some(line => pattern.test(line)))
}

/** The comment block immediately above `at`, which belongs to it. */
function withLeadingComments(lines: string[], at: number): number {
  let start = at
  while (start - 1 >= 0) {
    const previous = lines[start - 1]!.trim()
    if (previous.startsWith('#') || previous === '')
      start--
    else break
  }
  // Keep a blank separator line before the next thing.
  while (start < at && lines[start]!.trim() === '')
    start++
  return start
}

/**
 * Remove every step that runs against the vendored core, and every job left
 * with nothing to do — then repair the `needs:` lists that named them.
 *
 * A job is dropped whole when all of its steps referenced core: what is left is
 * a checkout and an install that assert nothing.
 */
export function pruneVendoredCoreFromWorkflow(source: string): { yaml: string, removedJobs: string[], removedSteps: number } {
  let lines = source.split('\n')
  const removedJobs: string[] = []
  let removedSteps = 0

  // Jobs last-first, so an edit never shifts the span of one not yet handled.
  for (const job of jobStarts(lines).reverse()) {
    const end = blockEnd(lines, job.at, 2)
    const body = lines.slice(job.at, end)

    const steps: { at: number, end: number, core: boolean, setup: boolean }[] = []
    for (const [offset, line] of body.entries()) {
      if (!/^ {6}- /.test(line))
        continue
      const at = job.at + offset
      const stepEnd = blockEnd(lines, at, 6)
      const step = lines.slice(at, stepEnd)
      steps.push({ at, end: stepEnd, core: step.some(referencesCore), setup: isSetupStep(step) })
    }

    if (steps.length === 0 || !steps.some(step => step.core))
      continue

    // Setup steps do not count: a job left with only a checkout and an install
    // is a job that no longer does anything.
    if (steps.filter(step => !step.setup).every(step => step.core)) {
      lines.splice(withLeadingComments(lines, job.at), end - withLeadingComments(lines, job.at))
      removedJobs.push(job.name)
      continue
    }

    for (const step of [...steps].reverse()) {
      if (!step.core)
        continue
      const from = withLeadingComments(lines, step.at)
      lines.splice(from, step.end - from)
      removedSteps++
    }
  }

  if (removedJobs.length > 0) {
    lines = lines.map((line) => {
      const inline = line.match(/^(\s*needs:\s*)\[([^\]]*)\]\s*$/)
      if (inline) {
        const kept = inline[2]!.split(',').map(name => name.trim()).filter(name => name && !removedJobs.includes(name))
        return kept.length > 0 ? `${inline[1]}[${kept.join(', ')}]` : ''
      }

      const scalar = line.match(/^(\s*)needs:\s*([A-Za-z_][\w-]*)\s*$/)
      if (scalar && removedJobs.includes(scalar[2]!))
        return ''

      return line
    }).filter((line, at, all) => !(line === '' && all[at - 1] === '' && all[at + 1] === ''))
  }

  return { yaml: lines.join('\n'), removedJobs, removedSteps }
}

/**
 * Apply {@link pruneVendoredCoreFromWorkflow} to every workflow in a project,
 * writing back only the files that actually changed.
 *
 * Best-effort by design: an unreadable or unusual workflow is left exactly as
 * it is. This runs at the end of an unvendor that has already rewritten
 * package.json and deleted the source tree, and a project whose CI is untidy is
 * a much smaller problem than one whose unvendor died halfway through.
 */
export async function pruneVendoredCoreFromWorkflows(cwd: string): Promise<WorkflowPrune[]> {
  const { readdir, readFile, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const dir = join(cwd, '.github', 'workflows')
  const pruned: WorkflowPrune[] = []

  let entries: string[]
  try {
    entries = await readdir(dir)
  }
  catch {
    return pruned
  }

  for (const entry of entries.sort()) {
    if (!/\.ya?ml$/.test(entry))
      continue

    const file = join(dir, entry)
    try {
      const source = await readFile(file, 'utf-8')
      const result = pruneVendoredCoreFromWorkflow(source)

      if (result.yaml === source)
        continue

      await writeFile(file, result.yaml)
      pruned.push({ file: `.github/workflows/${entry}`, removedJobs: result.removedJobs, removedSteps: result.removedSteps })
    }
    catch {
      continue
    }
  }

  return pruned
}

/**
 * Point `typecheck` at this project once it stops being the framework.
 *
 * The scaffold's `typecheck` runs the FRAMEWORK's tsconfig project, which
 * checks `storage/framework/**` and deliberately excludes `app/`, `config/`,
 * `resources/` and `routes/` — those belong to the root project, checked
 * separately. In the framework repository that split is right. In an app it
 * means the one command anybody runs, and the one CI calls, checks everything
 * except the code they actually write. Silently, and forever: it reports zero
 * errors on a file it never opened.
 *
 * Returns a new scripts object, or null when there is nothing to change.
 */
export function splitFrameworkTypecheckScript(scripts: Record<string, string>): Record<string, string> | null {
  const typecheck = scripts.typecheck

  if (!typecheck?.includes('tsconfig.framework.json') || !scripts['typecheck:app'])
    return null

  return Object.fromEntries(
    Object.entries(scripts).flatMap(([name, script]) => name === 'typecheck'
      ? [['typecheck', 'bun run typecheck:app && bun run typecheck:framework'], ['typecheck:framework', script]]
      : [[name, script]]),
  )
}
