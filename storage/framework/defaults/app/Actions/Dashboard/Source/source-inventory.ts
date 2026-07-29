import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'

export interface SourceInventoryItem {
  name: string
  description: string
  path: string
  origin: 'Application' | 'Framework'
  modifiedAt: string
  method?: string
  aliases?: string[]
  options?: string[]
}
interface SourceRoot {
  directory: string
  origin: SourceInventoryItem['origin']
}

function quotedArgument(source: string, pattern: RegExp, fallback = ''): string {
  return source.match(pattern)?.[1]?.trim() || fallback
}

export function parseActionSource(
  source: string,
  path: string,
  origin: SourceInventoryItem['origin'],
  modifiedAt = '',
): SourceInventoryItem | null {
  const actionStart = source.search(/\bnew\s+Action\s*\(/)
  if (actionStart < 0)
    return null

  const actionSource = source.slice(actionStart)
  const fallbackName = basename(path).replace(/\.[^.]+$/, '')
  return {
    name: quotedArgument(actionSource, /\bname\s*:\s*['"`]([^'"`]+)['"`]/, fallbackName),
    description: quotedArgument(actionSource, /\bdescription\s*:\s*['"`]([^'"`]+)['"`]/, 'No description provided.'),
    method: quotedArgument(actionSource, /\bmethod\s*:\s*['"`]([^'"`]+)['"`]/, 'ANY').toUpperCase(),
    path,
    origin,
    modifiedAt,
  }
}

export function parseCommandSource(
  source: string,
  path: string,
  registeredSignature: string,
  aliases: string[] = [],
  modifiedAt = '',
): SourceInventoryItem {
  const command = source.match(/\.command\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*['"`]([^'"`]+)['"`])?/)
  const sourceAliases = [...source.matchAll(/\.alias\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map(match => match[1])
  const options = [...source.matchAll(/\.option\(\s*['"`]([^'"`]+)['"`]/g)].map(match => match[1])

  return {
    name: command?.[1] || registeredSignature,
    description: command?.[2] || 'No description provided.',
    aliases: [...new Set([...aliases, ...sourceAliases])],
    options: [...new Set(options)],
    path,
    origin: 'Application',
    modifiedAt,
  }
}

export async function discoverActionSources(projectRoot: string): Promise<SourceInventoryItem[]> {
  const roots: SourceRoot[] = [
    {
      directory: join(projectRoot, 'storage/framework/defaults/app/Actions'),
      origin: 'Framework',
    },
    {
      directory: join(projectRoot, 'app/Actions'),
      origin: 'Application',
    },
  ]
  const actions = new Map<string, SourceInventoryItem>()

  for (const root of roots) {
    if (!existsSync(root.directory))
      continue

    const glob = new Bun.Glob('**/*.ts')
    for await (const file of glob.scan({ cwd: root.directory, absolute: true, onlyFiles: true })) {
      const sourcePath = relative(root.directory, file)
      if (sourcePath.endsWith('.test.ts') || basename(sourcePath).startsWith('_'))
        continue

      const item = parseActionSource(
        readFileSync(file, 'utf8'),
        relative(projectRoot, file),
        root.origin,
        statSync(file).mtime.toISOString(),
      )
      if (item)
        actions.set(sourcePath, item)
    }
  }

  return [...actions.values()].sort((left, right) => {
    if (left.origin !== right.origin)
      return left.origin === 'Application' ? -1 : 1
    return left.name.localeCompare(right.name)
  })
}
