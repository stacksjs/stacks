import { Glob as BunGlob } from 'bun'

export interface GlobOptions {
  absolute?: boolean
  cwd?: string
  patterns?: string[]
  ignore?: string[]
  dot?: boolean
  deep?: number
  expandDirectories?: boolean
  onlyDirectories?: boolean
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

export function globSync(patterns: string | string[], options?: Omit<GlobOptions, 'patterns'>): string[] {
  const patternArray = typeof patterns === 'string' ? [patterns] : patterns
  const results: string[] = []

  for (const pattern of patternArray) {
    try {
      const globInstance = new BunGlob(pattern)
      const matches = globInstance.scanSync({
        cwd: options?.cwd,
        absolute: options?.absolute,
        dot: options?.dot,
        onlyFiles: options?.onlyFiles,
      })
      for (const match of matches) {
        results.push(match)
      }
    }
    catch (err) {
      if (!isEnoent(err)) throw err
      // Missing root directory — skip this pattern, keep going.
    }
  }

  return results
}

export async function glob(patterns: string | string[], options?: Omit<GlobOptions, 'patterns'>): Promise<string[]> {
  const patternArray = typeof patterns === 'string' ? [patterns] : patterns
  const results: string[] = []

  for (const pattern of patternArray) {
    try {
      const globInstance = new BunGlob(pattern)
      const matches = globInstance.scan({
        cwd: options?.cwd,
        absolute: options?.absolute,
        dot: options?.dot,
        onlyFiles: options?.onlyFiles,
      })
      for await (const match of matches) {
        results.push(match)
      }
    }
    catch (err) {
      if (!isEnoent(err)) throw err
      // Missing root directory — skip this pattern, keep going.
    }
  }

  return results
}
