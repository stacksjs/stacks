import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { workspaceSourcePaths } from '../../storage/framework/core/alias/src/workspace'

export const workspaceConfigs = ['tsconfig.app.json', 'tsconfig.framework.json', 'tsconfig.defaults.json', 'core/tsconfig.json', 'core/tsconfig.build.json'] as const

/** Validate every mapping before writing any of the maintained configs. */
export function generateWorkspaceAliases(root: string, check = false): void {
  const framework = join(root, 'storage/framework'), core = join(framework, 'core')
  const updates = workspaceConfigs.map((name) => {
    const path = join(framework, name), original = readFileSync(path, 'utf8')
    const config = Bun.JSONC.parse(original) as { compilerOptions: { paths: Record<string, string[]> } }
    const generated = workspaceSourcePaths(core, dirname(path))
    const preserved = Object.fromEntries(Object.entries(config.compilerOptions.paths).filter(([key]) => !key.startsWith('@stacksjs/') && !key.startsWith('stacks/') && key !== 'stacks'))
    const lines = Object.entries({ ...generated, ...preserved }).map(([key, value]) => `      ${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    const newline = original.includes('\r\n') ? '\r\n' : '\n'
    const block = ['    "paths": {', '      // Generated workspace identities and public exports. Run bun .github/scripts/generate-workspace-aliases.ts.', lines.join(`,${newline}`), '    }'].join(newline)
    const updated = original.replace(/    "paths": \{[\s\S]*?\n    \}/, block)
    if (!original.includes('    "paths": {') || updated === original && !original.includes('// Generated workspace identities')) throw new Error(`Cannot locate workspace paths: ${path}`)
    return { path, original, updated }
  })
  const stale = updates.filter(item => item.original !== item.updated)
  if (check && stale.length) throw new Error(`Stale workspace aliases: ${stale.map(item => item.path).join(', ')}. Run bun .github/scripts/generate-workspace-aliases.ts`)
  if (!check) for (const item of stale) writeFileSync(item.path, item.updated)
}

if (import.meta.main) generateWorkspaceAliases(fileURLToPath(new URL('../../', import.meta.url)), process.argv.includes('--check'))
