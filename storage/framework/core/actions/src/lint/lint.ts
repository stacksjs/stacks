import process from 'node:process'
import { log } from '@stacksjs/cli'
import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { runFormat, runLint } from 'pickier'
import { isIgnoredLocation, isLintableExtension, isLintablePath } from './files'

// Code-style actions, exported as plain functions so commands (`buddy lint`)
// and the release pipeline import and call them directly. They drive pickier
// through its JS SDK (`runLint` / `runFormat`) — no `bunx pickier` subprocess.
// The thin `./index.ts` / `./fix.ts` entrypoints wrap these for `runAction`,
// which still spawns them by path.

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
 *
 * Outside a git repository there is no .gitignore to honour, so the directory
 * is walked under the same {@link isLintablePath} rules.
 *
 * Any other git failure THROWS. It used to return an empty list, which
 * `lintProject` reported as a clean project: a broken `git` on the PATH (a
 * toolchain shim pointing at a deleted directory was enough) made `buddy lint`
 * print "Linted" in 0.02s, having opened nothing, on a tree with problems.
 */
export function lintableFiles(cwd: string): string[] {
  const listed = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })

  if (listed.status === 0)
    return listed.stdout.split('\0').filter(isLintablePath)

  const notInstalled = (listed.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT'
  const stderr = (listed.stderr ?? '').trim()
  if ((notInstalled && !existsSync(join(cwd, '.git'))) || /not a git repository/i.test(stderr))
    return walkLintableFiles(cwd)

  const reason = listed.error?.message || stderr || `exit code ${listed.status ?? listed.signal}`
  throw new Error(`Could not list the files to lint: \`git ls-files\` failed in ${cwd} (${reason})`)
}

/**
 * Narrow the project's lintable files to the paths a caller named.
 *
 * A path that matches nothing THROWS rather than falling back to the whole
 * project. `buddy lint` and `buddy lint:fix` used to accept positional paths,
 * discard them and run over everything, so naming one file rewrote 43: a
 * caller who believes they scoped the change has to hear otherwise rather
 * than read it out of `git status` (stacksjs/stacks#2953).
 *
 * Selection runs over {@link lintableFiles}, so .gitignore and the lintable
 * extensions still decide, and naming a directory lints what is inside it.
 */
export function selectLintableFiles(cwd: string, paths: readonly string[]): string[] {
  const all = lintableFiles(cwd)
  const pool = new Set(all)
  const selected = new Set<string>()

  for (const named of paths) {
    const rel = projectRelative(cwd, named)
    if (rel === null)
      throw new Error(`Cannot lint ${named}: it is outside the project at ${cwd}`)

    // The whole project, named explicitly (`.` or the root itself).
    if (rel === '') {
      for (const file of all) selected.add(file)
      continue
    }

    if (pool.has(rel)) {
      selected.add(rel)
      continue
    }

    const under = all.filter(file => file.startsWith(`${rel}/`))
    if (under.length === 0)
      throw new Error(whyNotLintable(cwd, named, rel))

    for (const file of under) selected.add(file)
  }

  return [...selected].sort()
}

/** `named` as a project-relative POSIX path, or null if it escapes `cwd`. */
function projectRelative(cwd: string, named: string): string | null {
  const rel = relative(cwd, resolve(cwd, named)).split('\\').join('/').replace(/\/+$/, '')
  if (rel === '..' || rel.startsWith('../'))
    return null
  return rel === '.' ? '' : rel
}

/**
 * Why a path the caller named is not in the lintable set. Each case is a
 * different mistake and a different fix, so they do not share a message.
 */
function whyNotLintable(cwd: string, named: string, rel: string): string {
  const onDisk = join(cwd, rel)
  if (!existsSync(onDisk))
    return `Cannot lint ${named}: no such file or directory`
  if (isIgnoredLocation(rel))
    return `Cannot lint ${named}: it is dependency, build or cache output, which buddy lint never reads`
  if (statSync(onDisk).isDirectory())
    return `Cannot lint ${named}: it holds no files buddy lint handles`
  if (!isLintableExtension(rel))
    return `Cannot lint ${named}: buddy lint handles .ts, .js, .stx, .json, .md, .yaml and .yml files`
  return `Cannot lint ${named}: it is not one of the project's files, so .gitignore excludes it`
}

/** Every lintable file under `cwd`, for a directory git cannot list. */
function walkLintableFiles(cwd: string): string[] {
  return Array.from(new Bun.Glob('**/*').scanSync({ cwd, onlyFiles: true, dot: true }))
    .map(file => file.split('\\').join('/'))
    .filter(isLintablePath)
    .sort()
}

/**
 * Lint (optionally auto-fix) the project's tracked source via pickier's SDK.
 * Returns `{ ok }` rather than exiting, so callers keep control of the process.
 * pickier auto-discovers its own config (pickier.config.ts, .config/pickier.ts,
 * …), so we don't pass one.
 */
export async function lintProject(options: { cwd?: string, fix?: boolean, maxWarnings?: number, paths?: readonly string[] } = {}): Promise<{ ok: boolean }> {
  const cwd = options.cwd ?? process.cwd()
  log.info(options.fix ? 'Ensuring Code Style...' : 'Checking Code Style...')
  const maxWarnings = options.maxWarnings ?? 9999
  if (!Number.isInteger(maxWarnings) || maxWarnings < -1) {
    await log.error('maxWarnings must be an integer of -1 or greater')
    return { ok: false }
  }

  let files: string[]
  try {
    files = options.paths?.length ? selectLintableFiles(cwd, options.paths) : lintableFiles(cwd)
  }
  catch (error) {
    await log.error(error instanceof Error ? error.message : String(error))
    return { ok: false }
  }
  if (!files.length) {
    log.success('Linted: no lintable files')
    return { ok: true }
  }

  // runLint prints its own scan summary and returns 0 on success. A generous
  // max-warnings keeps warnings non-fatal unless the caller sets a stricter budget.
  const code = await runLint(files, { maxWarnings, fix: options.fix })
  const ok = code === 0
  if (ok)
    log.success('Linted')

  return { ok }
}

/** Auto-fix the project's code style — `lintProject` with fixing enabled. */
export function lintFix(options: { cwd?: string, maxWarnings?: number, paths?: readonly string[] } = {}): Promise<{ ok: boolean }> {
  return lintProject({ ...options, fix: true })
}

/**
 * Format the project via pickier's SDK. `write` applies changes; `check`
 * verifies formatting without writing (fails if anything is unformatted).
 */
export async function formatProject(options: { cwd?: string, write?: boolean, check?: boolean, paths?: readonly string[] } = {}): Promise<{ ok: boolean }> {
  const cwd = options.cwd ?? process.cwd()
  let files: string[]
  try {
    files = options.paths?.length ? selectLintableFiles(cwd, options.paths) : lintableFiles(cwd)
  }
  catch (error) {
    await log.error(error instanceof Error ? error.message : String(error))
    return { ok: false }
  }
  if (!files.length)
    return { ok: true }

  const code = await runFormat(files, { write: options.write, check: options.check })
  return { ok: code === 0 }
}
