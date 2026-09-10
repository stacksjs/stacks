/**
 * The imports in `docs/` code samples, compiled for real (stacksjs/stacks#2580).
 *
 * `docs/` holds ~1,870 TypeScript blocks and nothing verified any of them. Code
 * samples rot the same way prose does, except silently: a reader assumes a
 * fenced block was true at least once.
 *
 * ## Why imports, and not the blocks
 *
 * Compiling whole blocks does not work - most are fragments without their
 * surrounding context, deliberately partial, or illustrative. An IMPORT
 * statement is complete by itself, so it can be compiled with no context at
 * all, and it carries the rot that actually bites: a doc telling you to import
 * something that no longer exists.
 *
 * ## Why compiled, and not scanned
 *
 * Text-scanning imports against a package's exports was tried before and
 * abandoned: it reported 187 false positives, because `@stacksjs/router` does
 * `export * from '@stacksjs/bun-router'` and a regex cannot follow a re-export.
 * `tsc` follows it. That is the whole reason this writes files and runs a
 * compiler rather than reading `index.ts`.
 *
 * ## What is in scope
 *
 * Every specifier this repository can actually resolve, plus every
 * `@stacksjs/*` one whether it resolves or not - a framework package that does
 * not resolve is exactly the finding worth having, and `@stacksjs/dashboard`
 * appeared in seven samples for a package that has never existed.
 *
 * A third-party specifier that does not resolve is SKIPPED. `aws-cdk-lib`,
 * `@sentry/bun` and `mailparser` are absent because this repository does not
 * install them, which says nothing about the documentation. Failing on those
 * would be the 187-false-positive mistake in a new costume.
 *
 * Usage: `bun storage/framework/core/buddy/src/commands/docs/snippets.ts [--check|--write]`
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import process from 'node:process'
import { assertFrameworkRepo } from './framework-repo'

const root = new URL('../../../../../../../', import.meta.url).pathname
const docsDir = join(root, 'docs')
/** Gitignored machine-local state; the generated files are never committed. */
const workDir = join(root, 'storage/framework/runtime/docs-imports')
const baselinePath = join(root, 'docs/.snippet-imports-baseline.json')

/** One import statement, and where a reader would find it. */
export interface DocsImport {
  file: string
  line: number
  text: string
  specifier: string
}

/** A compile failure, traced back to the documentation that caused it. */
export interface SnippetFinding {
  file: string
  line: number
  specifier: string
  code: string
  message: string
}

const FENCE = /^```(?:ts|typescript)\b/

/**
 * Every import statement inside a TypeScript block in `contents`.
 *
 * Multi-line imports are joined: `import {\n  a,\n} from 'x'` is one statement,
 * and reading it a line at a time would report the first line as a syntax
 * error. The scan gives up after twelve lines rather than running to the end of
 * a document that never closes the statement.
 */
export function extractImports(file: string, contents: string): DocsImport[] {
  const found: DocsImport[] = []
  const lines = contents.split('\n')
  let inside = false
  let pending: { line: number, text: string } | null = null

  const specifierOf = (text: string): string | undefined =>
    text.match(/from\s+['"]([^'"]+)['"]/)?.[1] ?? text.match(/^\s*import\s+['"]([^'"]+)['"]/)?.[1]

  const finish = (entry: { line: number, text: string }): void => {
    const specifier = specifierOf(entry.text)
    // Relative specifiers cannot resolve from a document - there is no file to
    // be relative to - so they are out of scope rather than failures.
    if (specifier && !specifier.startsWith('.'))
      found.push({ file, line: entry.line, text: entry.text.trim(), specifier })
  }

  for (const [index, raw] of lines.entries()) {
    if (raw.startsWith('```')) {
      inside = !inside && FENCE.test(raw.trim())
      pending = null
      continue
    }
    if (!inside)
      continue

    if (pending) {
      pending.text += `\n${raw.trimEnd()}`
      if (specifierOf(pending.text)) {
        finish(pending)
        pending = null
      }
      else if (pending.text.split('\n').length > 12) {
        pending = null
      }
      continue
    }

    if (!/^\s*import\s/.test(raw))
      continue

    const entry = { line: index + 1, text: raw.trimEnd() }
    if (specifierOf(entry.text))
      finish(entry)
    else
      pending = entry
  }

  return found
}

/** Every markdown file under `docs/`. */
function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory())
      return markdownFiles(full)
    return entry.name.endsWith('.md') ? [full] : []
  })
}

export function collectImports(): DocsImport[] {
  return markdownFiles(docsDir).flatMap(file =>
    extractImports(file.slice(root.length), readFileSync(file, 'utf8')),
  )
}

/**
 * A stable identity for one finding, so a baseline survives edits elsewhere in
 * the same document.
 *
 * The line number is deliberately NOT part of it: adding a paragraph above a
 * sample would otherwise retire every baseline entry below it and report the
 * same rot as new.
 */
export function findingKey(finding: Pick<SnippetFinding, 'file' | 'specifier' | 'message'>): string {
  return `${finding.file} :: ${finding.specifier} :: ${finding.message}`
}

/** Whether a failure to resolve this specifier is worth reporting. */
export function inScope(specifier: string, code: string): boolean {
  if (code !== 'TS2307')
    return true
  // A third-party package this repository does not install is absent for a
  // reason that has nothing to do with the documentation.
  return specifier.startsWith('@stacksjs/')
}

function compile(imports: DocsImport[]): SnippetFinding[] {
  rmSync(workDir, { force: true, recursive: true })
  mkdirSync(workDir, { recursive: true })

  const byName = new Map<string, DocsImport>()
  for (const entry of imports) {
    const name = `i${createHash('sha1').update(entry.text).digest('hex').slice(0, 16)}`
    if (byName.has(name))
      continue
    byName.set(name, entry)
    // `export {}` makes each file a module, so two samples importing the same
    // name do not collide as duplicate top-level identifiers.
    writeFileSync(join(workDir, `${name}.ts`), `${entry.text}\nexport {}\n`)
  }

  writeFileSync(join(workDir, 'tsconfig.json'), `${JSON.stringify({
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      noEmit: true,
      skipLibCheck: true,
      noUnusedLocals: false,
      isolatedDeclarations: false,
      verbatimModuleSyntax: false,
    },
    include: ['./*.ts'],
  }, null, 2)}\n`)

  const proc = Bun.spawnSync(['bunx', '--bun', 'tsc', '--noEmit', '-p', workDir], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const output = `${proc.stdout.toString()}${proc.stderr.toString()}`
  const findings: SnippetFinding[] = []

  for (const line of output.split('\n')) {
    const match = line.match(/docs-imports\/(i[0-9a-f]+)\.ts.*?error (TS\d+): (.*)$/)
    if (!match)
      continue
    const entry = byName.get(match[1]!)
    if (!entry)
      continue
    if (!inScope(entry.specifier, match[2]!))
      continue
    findings.push({
      file: entry.file,
      line: entry.line,
      specifier: entry.specifier,
      code: match[2]!,
      message: match[3]!.trim(),
    })
  }

  rmSync(workDir, { force: true, recursive: true })
  return findings
}

function readBaseline(): string[] {
  try {
    return JSON.parse(readFileSync(baselinePath, 'utf8')).known ?? []
  }
  catch {
    return []
  }
}

export async function run(): Promise<void> {
  // This tool writes into the framework repository. See framework-repo.ts.
  assertFrameworkRepo(root, 'docs:snippets')

  const imports = collectImports()
  const findings = compile(imports)
  const baseline = new Set(readBaseline())
  const keys = findings.map(findingKey)

  if (process.argv.includes('--write')) {
    writeFileSync(baselinePath, `${JSON.stringify({
      // Recorded so a check can land before the backlog is cleared. Every entry
      // is a documented import that does not compile; the list should only ever
      // get shorter.
      comment: 'Known docs-import failures. Run `buddy docs:snippets` after fixing some, and commit the shorter list. See stacksjs/stacks#2580.',
      known: [...new Set(keys)].sort(),
    }, null, 2)}\n`)
    console.log(`✓ recorded ${new Set(keys).size} known docs-import failure(s) across ${imports.length} import(s)`)
    return
  }

  const fresh = findings.filter(finding => !baseline.has(findingKey(finding)))
  const fixed = [...baseline].filter(entry => !new Set(keys).has(entry))

  if (fresh.length === 0) {
    const trailer = fixed.length > 0
      ? ` (${fixed.length} baselined failure(s) now fixed - run \`buddy docs:snippets\` to shorten the baseline)`
      : ''
    console.log(`✓ no new docs-import failures across ${imports.length} import(s)${trailer}`)
    return
  }

  console.error(`✗ ${fresh.length} documented import(s) do not compile:`)
  for (const finding of fresh)
    console.error(`  ${finding.file}:${finding.line}  ${finding.specifier}\n      ${finding.message}`)
  console.error('\nFix the sample, or run `buddy docs:snippets` to record it if it is expected.')

  if (process.argv.includes('--check'))
    process.exit(1)
}

if (import.meta.main)
  await run()
