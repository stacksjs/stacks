import { readdirSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

export interface ModelRegistryOptions {
  userRoot: string
  defaultsRoot: string
  onImportError?: (file: string, error: unknown) => void
}

export function modelFiles(root: string): string[] {
  const files: string[] = []

  const walk = (directory: string): void => {
    let entries: ReturnType<typeof readdirSync>
    try {
      entries = readdirSync(directory, { withFileTypes: true }) as ReturnType<typeof readdirSync>
    }
    catch {
      return
    }

    for (const entry of entries as any[]) {
      const file = join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(file)
        continue
      }
      if (!['.ts', '.js'].includes(extname(entry.name)))
        continue
      if (entry.name.startsWith('.') || entry.name.startsWith('index'))
        continue
      files.push(file)
    }
  }

  walk(root)
  return files.sort()
}

async function loadRoot(
  root: string,
  registry: Record<string, any>,
  onImportError?: ModelRegistryOptions['onImportError'],
): Promise<void> {
  for (const file of modelFiles(root)) {
    try {
      const extension = extname(file)
      const module = await import(`${file}?t=${Date.now()}`)
      const definition = module.default ?? module
      const name = definition.name ?? basename(file, extension)
      registry[name] = { ...definition, name }
    }
    catch (error) {
      onImportError?.(file, error)
    }
  }
}

export async function loadModelRegistry(options: ModelRegistryOptions): Promise<Record<string, any>> {
  const registry: Record<string, any> = {}

  await loadRoot(options.defaultsRoot, registry, options.onImportError)
  await loadRoot(options.userRoot, registry, options.onImportError)

  return registry
}
