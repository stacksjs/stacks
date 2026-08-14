import { dirname } from 'node:path'

export interface CraftBuilderProvenance {
  package: 'craft-native'
  source: 'package' | 'path'
  revision?: string
}

export function resolveCraftBuilderProvenance(explicitSource?: string): CraftBuilderProvenance {
  if (!explicitSource) return { package: 'craft-native', source: 'package' }

  const git = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: dirname(explicitSource) })
  const revision = git.exitCode === 0 ? git.stdout.toString().trim() : ''

  return {
    package: 'craft-native',
    source: 'path',
    ...(/^[\da-f]{40}$/.test(revision) ? { revision } : {}),
  }
}
