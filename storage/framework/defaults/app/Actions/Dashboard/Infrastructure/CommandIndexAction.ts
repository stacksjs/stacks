import { Action } from '@stacksjs/actions'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'
import { parseCommandSource } from '../Source/source-inventory'

interface CommandConfig {
  file: string
  enabled?: boolean
  aliases?: string[]
}

export default new Action({
  name: 'CommandIndexAction',
  description: 'Lists commands registered by the application.',
  method: 'GET',
  async handle() {
    const projectRoot = process.cwd()
    const registryPath = join(projectRoot, 'app/Commands.ts')
    const registryModule = await import(registryPath)
    const registry = (registryModule.default || {}) as Record<string, string | CommandConfig>
    const items = Object.entries(registry).flatMap(([signature, value]) => {
      const config = typeof value === 'string'
        ? { file: value, enabled: true, aliases: [] }
        : { enabled: true, aliases: [], ...value }
      const file = join(projectRoot, 'app/Commands', `${config.file}.ts`)
      if (!existsSync(file))
        return []

      return [parseCommandSource(
        readFileSync(file, 'utf8'),
        relative(projectRoot, file),
        signature,
        config.aliases,
        statSync(file).mtime.toISOString(),
      )]
    })

    return {
      items,
      stats: {
        total: items.length,
        aliases: items.reduce((sum, item) => sum + (item.aliases?.length || 0), 0),
        options: items.reduce((sum, item) => sum + (item.options?.length || 0), 0),
        registered: Object.keys(registry).length,
      },
    }
  },
})
