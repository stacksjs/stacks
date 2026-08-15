import process from 'node:process'
import { log } from '@stacksjs/cli'
import { execSync } from 'node:child_process'
import { runFormat, runLint } from 'pickier'

// Code-style actions, exported as plain functions so commands (`buddy lint`)
// and the release pipeline import and call them directly. They drive pickier
// through its JS SDK (`runLint` / `runFormat`) — no `bunx pickier` subprocess.
// The thin `./index.ts` / `./fix.ts` entrypoints wrap these for `runAction`,
// which still spawns them by path.

const lintableFile = /\.(?:ts|js|json|md|yaml|yml)$/i
const ignoredPath = /(?:^|\/)(?:node_modules|dist|pantry|storage\/framework\/cache|\.git|\.stx|\.stx-serve)(?:\/|$)/

/**
 * The project's lintable files: everything git tracks, plus everything git
 * would let you add.
 *
 * `--others --exclude-standard` is what makes this correct rather than merely
 * broader. Listing tracked files alone skips every file that has not been
 * staged yet, which is precisely the set a new commit introduces: you write a
 * file, `buddy lint` says the project is clean because it never opened it, you
 * commit, and CI fails on the file you just linted. `--exclude-standard` keeps
 * .gitignore honoured, so build output and dependencies stay out.
 */
export function lintableFiles(cwd: string): string[] {
  try {
    // stderr is discarded: outside a git repository this prints "fatal: not a
    // git repository", and the caller goes on to report a clean lint, so the
    // only thing the message achieves is making a success look like a failure.
    return execSync('git ls-files -z --cached --others --exclude-standard', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\0')
      .filter(file => lintableFile.test(file) && !ignoredPath.test(file))
  }
  catch {
    return []
  }
}

/**
 * Lint (optionally auto-fix) the project's tracked source via pickier's SDK.
 * Returns `{ ok }` rather than exiting, so callers keep control of the process.
 * pickier auto-discovers its own config (pickier.config.ts, .config/pickier.ts,
 * …), so we don't pass one.
 */
export async function lintProject(options: { cwd?: string, fix?: boolean } = {}): Promise<{ ok: boolean }> {
  const cwd = options.cwd ?? process.cwd()
  log.info(options.fix ? 'Ensuring Code Style...' : 'Checking Code Style...')

  const files = lintableFiles(cwd)
  if (!files.length) {
    log.success('Linted')
    return { ok: true }
  }

  // runLint prints its own scan summary and returns 0 on success. A generous
  // max-warnings keeps warnings non-fatal (only errors fail the build).
  const code = await runLint(files, { maxWarnings: 9999, fix: options.fix })
  const ok = code === 0
  if (ok)
    log.success('Linted')

  return { ok }
}

/** Auto-fix the project's code style — `lintProject` with fixing enabled. */
export function lintFix(options: { cwd?: string } = {}): Promise<{ ok: boolean }> {
  return lintProject({ ...options, fix: true })
}

/**
 * Format the project via pickier's SDK. `write` applies changes; `check`
 * verifies formatting without writing (fails if anything is unformatted).
 */
export async function formatProject(options: { cwd?: string, write?: boolean, check?: boolean } = {}): Promise<{ ok: boolean }> {
  const cwd = options.cwd ?? process.cwd()
  const files = lintableFiles(cwd)
  if (!files.length)
    return { ok: true }

  const code = await runFormat(files, { write: options.write, check: options.check })
  return { ok: code === 0 }
}
