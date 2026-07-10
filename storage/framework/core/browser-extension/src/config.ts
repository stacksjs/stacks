import type { ExtensionConfig } from './types'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Identity helper for authoring `config/extension.ts` with full type-checking
 * and editor completion:
 *
 * ```ts
 * // config/extension.ts
 * import { defineExtension } from '@stacksjs/browser-extension'
 * export default defineExtension({ name: 'My Extension', description: '…', … })
 * ```
 */
export function defineExtension(config: ExtensionConfig): ExtensionConfig {
  return config
}

/**
 * Load the project's extension config from `config/extension.ts` (default
 * export). Returns null when the project has no extension config.
 */
export async function loadExtensionConfig(cwd: string = process.cwd()): Promise<ExtensionConfig | null> {
  for (const rel of ['config/extension.ts', 'extension.config.ts']) {
    const path = resolve(cwd, rel)
    if (!existsSync(path))
      continue
    const mod = await import(path)
    const config = (mod.default ?? mod.extension ?? mod.config) as ExtensionConfig | undefined
    if (config)
      return config
  }
  return null
}
