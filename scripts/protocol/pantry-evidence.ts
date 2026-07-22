import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '../..')
const outputPath = resolve(root, 'protocol/evidence/pantry.json')

export const pantryEvidence = {
  schemaVersion: 1,
  status: 'pinned',
  issue: 'https://github.com/stacksjs/stacks/issues/2066',
  source: {
    repository: 'https://github.com/pantry-pm/pantry',
    version: '0.10.43',
    tag: 'v0.10.43',
    revision: 'c5e15260ccde34206082756a14d03e30cf1d7d5e',
  },
  whitepaper: {
    repository: 'https://github.com/stacksjs/white-paper',
    revision: 'd2a04ebe2129e29978a53dd3af7bfcd3c4e00568',
    evidenceLock: 'evidence/pantry/evidence.lock.json',
  },
  contracts: [
    {
      id: 'package-manager',
      sourcePath: 'docs/package-manager.md',
      sha256: '2a655fc1a33aef042340744c69b83afcc15446104f2a4f72ea9e208874c7301f',
      referencePath: 'docs/reference/package-manager.md',
    },
    {
      id: 'registry',
      sourcePath: 'docs/registry.md',
      sha256: 'c16a2ef8855d99b34398bddfd6f574e0e3001ce8a769dc6dd6792af418c4724b',
      referencePath: 'docs/reference/registry.md',
    },
  ],
  serviceContracts: [
    {
      id: 'github-actions-service-interface',
      sourcePath: 'packages/action/action.yml',
      sha256: '06f4ac3f3307a474e493abe56f1e8f7d99f7af8ce49cecbf3dfdd2e55333ea13',
    },
    {
      id: 'github-actions-redis-lifecycle',
      sourcePath: 'packages/action/src/services.ts',
      sha256: '7e88c89880bf1dc42cfee44f5a741b7659b2c2a1aced7da9c23520ed28a8afe9',
    },
    {
      id: 'github-actions-redis-orchestration',
      sourcePath: 'packages/action/src/index.ts',
      sha256: '8ec03abb32f51041f13291101d0c77865fe7232b9c7a4753942b48b3b9609678',
    },
    {
      id: 'github-actions-install-mode',
      sourcePath: 'packages/action/src/install-mode.ts',
      sha256: 'e3ff33f0197eb9607d9a74efd946d34c76aad21ed4af4b2a89169aa04db30581',
    },
    {
      id: 'github-actions-redis-cleanup',
      sourcePath: 'packages/action/src/post.ts',
      sha256: '9dbfa452e86a61ec75da8c461d69d10a4f493765c19523ba999ee4f916ccde54',
    },
    {
      id: 'native-service-readiness',
      sourcePath: 'packages/zig/src/cli/commands/services.zig',
      sha256: '7da9d6271b8dc755865db26a366202448cc408e0d2e3b0daa0a3b8cb917fd748',
    },
    {
      id: 'native-redis-definition',
      sourcePath: 'packages/zig/src/services/definitions.zig',
      sha256: 'faf362b6a9f037350b6baf7204f424e78b9bfe8704dfdfcf26e1daa1b5dce678',
    },
  ],
  verification: {
    documentationContracts: 'bun run docs:contracts:check (48 source-linked markers)',
    targetedBunTests: '11 passed, 0 failed',
    typecheck: 'bun run typecheck',
    nativeTests: 'zig build test',
    actionRedisService: 'Pantry CI action-redis-service job (Redis 8.8.0)',
    whitepaperCheck: 'bun run evidence:check',
  },
  boundaries: [
    'Pantry system packages, npm-compatible packages, and workspace/local packages use distinct resolution paths.',
    'npm fallback is read-only and does not publish npm packages into Pantry.',
    'Configured storage and authentication modes do not by themselves prove production readiness.',
    'Stacks consumes Pantry as a versioned toolchain boundary and does not redefine Pantry behavior.',
  ],
} as const

export function validatePantryEvidence(evidence: typeof pantryEvidence): string[] {
  const errors: string[] = []
  if (evidence.source.tag !== `v${evidence.source.version}`) errors.push('Pantry tag does not match its version')
  if (!/^[a-f0-9]{40}$/.test(evidence.source.revision)) errors.push('Pantry revision is not a full commit SHA')
  if (!/^[a-f0-9]{40}$/.test(evidence.whitepaper.revision)) errors.push('whitepaper revision is not a full commit SHA')
  if (evidence.contracts.length !== 2) errors.push('both canonical Pantry contracts must be pinned')
  for (const contract of evidence.contracts) {
    if (!/^[a-f0-9]{64}$/.test(contract.sha256)) errors.push(`${contract.id}: invalid SHA-256 digest`)
    if (!contract.sourcePath.endsWith('.md')) errors.push(`${contract.id}: source contract is not Markdown`)
    if (!contract.referencePath.startsWith('docs/reference/')) errors.push(`${contract.id}: whitepaper reference path is invalid`)
  }
  if (evidence.serviceContracts.length !== 7) errors.push('all Pantry Redis service contracts must be pinned')
  for (const contract of evidence.serviceContracts) {
    if (!/^[a-f0-9]{64}$/.test(contract.sha256)) errors.push(`${contract.id}: invalid SHA-256 digest`)
    if (!contract.sourcePath.startsWith('packages/')) errors.push(`${contract.id}: source path is outside Pantry packages`)
  }
  return errors
}

function serializedEvidence(): string {
  return `${JSON.stringify(pantryEvidence, null, 2)}\n`
}

function check(): void {
  const errors = validatePantryEvidence(pantryEvidence)
  if (!existsSync(outputPath)) errors.push('protocol/evidence/pantry.json is missing')
  else if (readFileSync(outputPath, 'utf8') !== serializedEvidence()) errors.push('Pantry evidence is stale; run bun run protocol:pantry')
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(`Pantry evidence pins ${pantryEvidence.source.tag} at ${pantryEvidence.source.revision}`)
}

if (import.meta.main) {
  if (process.argv.includes('--write')) {
    const errors = validatePantryEvidence(pantryEvidence)
    if (errors.length) throw new Error(errors.join('\n'))
    writeFileSync(outputPath, serializedEvidence())
    console.log(`Wrote Pantry evidence for ${pantryEvidence.source.tag}`)
  }
  else if (process.argv.includes('--check')) check()
  else {
    console.error('usage: bun scripts/protocol/pantry-evidence.ts --write | --check')
    process.exit(2)
  }
}
