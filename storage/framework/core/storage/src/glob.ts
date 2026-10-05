import { Glob as BunGlob } from 'bun'
import { statSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import process from 'node:process'

export interface GlobOptions {
  /** Return absolute paths. Matches of an absolute pattern are always absolute. */
  absolute?: boolean
  /** The directory relative patterns are matched from. @default process.cwd() */
  cwd?: string
  patterns?: string[]
  /**
   * Patterns whose matches are left out, tested against each match both as
   * returned and relative to `cwd` - so `**\/*.d.ts` and `node_modules/**`
   * both work whatever form the match takes.
   */
  ignore?: string[]
  /** Match entries whose names start with a dot. */
  dot?: boolean
  /**
   * How many directories below the pattern's base a match may sit: `0` is the
   * base's own entries, `1` one directory down, and so on. Unlimited by default.
   */
  deep?: number
  /**
   * Read a pattern naming a directory, with no glob characters, as everything
   * under it: `src` becomes `src/**`.
   */
  expandDirectories?: boolean
  /** Match directories only. */
  onlyDirectories?: boolean
  /** Match files only. The default, unless `onlyDirectories` is set. */
  onlyFiles?: boolean
}

/**
 * Bun's `Glob.scanSync` / `scan` throws `ENOENT` when the pattern's
 * root directory doesn't exist on disk. Almost every other glob
 * library on the planet returns `[]` for that case, and so does this
 * wrapper — most callers want "no matches" semantics, especially for
 * optional-directory globs like `app/Models/*.ts` (which doesn't
 * exist in fresh scaffolds or framework-repo test runs). Anything
 * other than ENOENT still bubbles up.
 */
function isEnoent(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === 'ENOENT'
}

const globCharacters = /[*?[\]{}!]/

/** The literal directories a pattern starts with: `src/models/**` -> `src/models`. */
function baseOf(pattern: string): string {
  const segments = pattern.split('/')
  const literal: string[] = []
  for (const segment of segments.slice(0, -1)) {
    if (globCharacters.test(segment))
      break
    literal.push(segment)
  }
  return literal.join('/') || (pattern.startsWith('/') ? '/' : '')
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  }
  catch {
    return false
  }
}

/**
 * Everything the scan itself cannot do, as one plan per pattern.
 *
 * Every option but four went no further than the type: `ignore`, `deep`,
 * `onlyDirectories` and `expandDirectories` were accepted and dropped. The
 * server's auto-import scan asked to skip `index.ts` and `*.d.ts` and got
 * both; `del('dist/*')` asked for directories and, given files, deleted
 * nothing.
 */
function plan(pattern: string, options: Omit<GlobOptions, 'patterns'> = {}): {
  pattern: string
  scan: { cwd?: string, absolute?: boolean, dot?: boolean, onlyFiles: boolean }
  keep: (match: string) => boolean
} {
  const cwd = options.cwd ?? process.cwd()

  let effective = pattern
  if (options.expandDirectories && !globCharacters.test(pattern) && isDirectory(isAbsolute(pattern) ? pattern : join(cwd, pattern)))
    effective = `${pattern.replace(/\/+$/, '')}/**`

  const onlyDirectories = options.onlyDirectories === true
  const onlyFiles = !onlyDirectories && options.onlyFiles !== false
  const ignore = (options.ignore ?? []).map(ignored => new BunGlob(ignored))
  const base = baseOf(effective)
  const baseDirectory = isAbsolute(base) ? base : join(cwd, base)

  const keep = (match: string): boolean => {
    const onDisk = isAbsolute(match) ? match : join(cwd, match)
    const fromCwd = relative(cwd, onDisk).split(sep).join('/')

    if (ignore.some(ignored => ignored.match(match) || ignored.match(fromCwd)))
      return false

    if (options.deep !== undefined) {
      // Directories between the pattern's literal base and the entry.
      const below = relative(baseDirectory, onDisk).split(sep).filter(Boolean).length - 1
      if (below > options.deep)
        return false
    }

    if (onlyDirectories && !isDirectory(onDisk))
      return false

    return true
  }

  return {
    pattern: effective,
    scan: { cwd: options.cwd, absolute: options.absolute, dot: options.dot, onlyFiles },
    keep,
  }
}

export function globSync(patterns: string | string[], options?: Omit<GlobOptions, 'patterns'>): string[] {
  const patternArray = typeof patterns === 'string' ? [patterns] : patterns
  const results = new Set<string>()

  for (const pattern of patternArray) {
    const { pattern: effective, scan, keep } = plan(pattern, options)
    try {
      for (const match of new BunGlob(effective).scanSync(scan)) {
        if (keep(match))
          results.add(match)
      }
    }
    catch (err) {
      if (!isEnoent(err)) throw err
      // Missing root directory — skip this pattern, keep going.
    }
  }

  return [...results]
}

export async function glob(patterns: string | string[], options?: Omit<GlobOptions, 'patterns'>): Promise<string[]> {
  const patternArray = typeof patterns === 'string' ? [patterns] : patterns
  const results = new Set<string>()

  for (const pattern of patternArray) {
    const { pattern: effective, scan, keep } = plan(pattern, options)
    try {
      for await (const match of new BunGlob(effective).scan(scan)) {
        if (keep(match))
          results.add(match)
      }
    }
    catch (err) {
      if (!isEnoent(err)) throw err
      // Missing root directory — skip this pattern, keep going.
    }
  }

  return [...results]
}
