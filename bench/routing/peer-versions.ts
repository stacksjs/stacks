import { resolveBenchmarkServerModules } from './provenance'
import { REPO_ROOT } from './runtime'

const PEER_PACKAGES: Readonly<Record<string, string>> = {
  elysia: 'elysia',
  express: 'express',
  fastify: 'fastify',
  hono: 'hono',
}

export function selectedPeerPackages(targetIds: readonly string[]): string[] {
  return targetIds.flatMap((id) => {
    const packageName = PEER_PACKAGES[id]
    return packageName ? [packageName] : []
  })
}

/** Read versions from the package files the benchmark servers actually resolve. */
export async function resolvePeerVersions(targetIds: readonly string[]): Promise<Record<string, string>> {
  const versions: Record<string, string> = {}
  const packageNames = selectedPeerPackages(targetIds)

  for (const packageName of packageNames) {
    try {
      const packageSpecifier = `${packageName}/package.json`
      const packageFile = resolveBenchmarkServerModules(REPO_ROOT, [packageSpecifier])[packageSpecifier]!
      const manifest = await Bun.file(packageFile).json() as { version?: unknown }
      versions[packageName] = typeof manifest.version === 'string' ? manifest.version : 'unavailable'
    }
    catch {
      versions[packageName] = 'unavailable'
    }
  }

  return versions
}
