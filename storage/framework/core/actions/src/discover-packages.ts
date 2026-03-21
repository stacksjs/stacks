import type { StackDirectory } from '@stacksjs/types'
import { projectPath, storagePath } from '@stacksjs/path'

export interface PackageStacksMeta {
  providers?: string[]
  routes?: string[]
  views?: string[]
  components?: string[]
  commands?: string[]
  middleware?: string[]
  migrations?: string[]
  /** Stack extension name (identifies this as a full Stack extension) */
  name?: string
  /** Stack extension description */
  description?: string
  /** Which top-level directories this stack provides */
  directories?: StackDirectory[]
}

export interface DiscoveredPackagesManifest {
  generated_at: string
  packages: Record<string, PackageStacksMeta>
}

export async function discoverPackages(): Promise<DiscoveredPackagesManifest> {
  const manifest: DiscoveredPackagesManifest = {
    generated_at: new Date().toISOString(),
    packages: {},
  }

  // Read dont-discover list from root package.json
  const dontDiscover = new Set<string>()
  try {
    const rootPkg = await Bun.file(projectPath('package.json')).json()
    const list = rootPkg?.stacks?.['dont-discover']
    if (Array.isArray(list)) {
      for (const name of list) dontDiscover.add(name)
    }
  }
  catch {
    // No root package.json or no stacks field
  }

  // Scan pantry for packages with a "stacks" field
  const pantryDir = projectPath('pantry')
  const patterns = ['*/package.json', '@*/*/package.json']

  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern)
    for await (const file of glob.scan({ cwd: pantryDir, absolute: true, onlyFiles: true })) {
      try {
        const pkg = await Bun.file(file).json()
        const name = pkg?.name
        if (!name || !pkg.stacks || dontDiscover.has(name)) continue
        manifest.packages[name] = pkg.stacks
      }
      catch {
        // Skip unreadable package.json files
      }
    }
  }

  // Write manifest
  const manifestPath = storagePath('framework/discovered-packages.json')
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2))

  return manifest
}
