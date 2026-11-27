import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface PreviewManifest {
  name: string
  private?: boolean
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
}

function readPreviewPackages(core: string) {
  return readdirSync(core, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    if (!entry.isDirectory()) return []
    const directory = join(core, entry.name)
    const path = join(directory, 'package.json')
    if (!existsSync(path)) return []
    const original = readFileSync(path, 'utf8')
    const manifest = JSON.parse(original) as PreviewManifest
    return manifest.private ? [] : [{ directory, path, original, manifest }]
  })
}

export function withCommitPreviewManifests<T>(packages: ReturnType<typeof readPreviewPackages>, publish: () => T): T {
  const published = new Set(packages.map(pkg => pkg.manifest.name))
  const changed = new Map<string, string>()
  try {
    for (const { path, original, manifest } of packages) {
      const peers = Object.entries(manifest.peerDependencies ?? {}).filter(([peer, version]) =>
        version.startsWith('workspace:') && published.has(peer) && !manifest.peerDependenciesMeta?.[peer]?.optional
        && !manifest.dependencies?.[peer] && !manifest.optionalDependencies?.[peer],
      )
      if (!peers.length) continue
      // The preview registry links ordinary sibling dependencies by commit
      // but leaves peer ranges on npm. Keep the range and provide its preview.
      changed.set(path, original)
      const dependencies = { ...manifest.dependencies, ...Object.fromEntries(peers) }
      writeFileSync(path, JSON.stringify({ ...manifest, dependencies }, null, 2) + '\n')
    }
    return publish()
  }
  finally {
    for (const [path, original] of changed) writeFileSync(path, original)
  }
}

if (import.meta.main) {
  const core = fileURLToPath(new URL('../core/', import.meta.url))
  const packages = readPreviewPackages(core)
  if (!packages.length) console.log('No public core packages found for pkg.pr.new')
  else {
    const directories = packages.map(pkg => pkg.directory)
    console.log(`Publishing ${directories.length} public core package previews:\n  ${directories.join('\n  ')}`)
    if (process.env.PUBLISH_COMMIT_DRY_RUN === '1') console.log('Dry run enabled; skipping pkg.pr.new publish')
    else {
      const result = withCommitPreviewManifests(packages, () =>
        Bun.spawnSync([process.execPath, 'x', 'pkg-pr-new', 'publish', '--bun', ...directories], {
          stdin: 'inherit', stdout: 'inherit', stderr: 'inherit',
        }),
      )
      process.exitCode = result.signalCode ? 1 : result.exitCode
    }
  }
}
