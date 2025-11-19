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

export function globSync(patterns: string | string[], options?: Omit<GlobOptions, 'patterns'>): string[] {
  const patternArray = typeof patterns === 'string' ? [patterns] : patterns
  const results: string[] = []

  for (const pattern of patternArray) {
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

  return results
}

export async function glob(patterns: string | string[], options?: Omit<GlobOptions, 'patterns'>): Promise<string[]> {
  const patternArray = typeof patterns === 'string' ? [patterns] : patterns
  const results: string[] = []

  for (const pattern of patternArray) {
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

  return results
}
