import { globSync as gs } from 'tinyglobby'
export { glob } from 'tinyglobby'

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

export const globSync = (patterns: string | string[], options?: Omit<GlobOptions, 'patterns'>) => {
  if (typeof patterns === 'string') {
    return gs([patterns], options)
  }

  return gs(patterns, options)
}
