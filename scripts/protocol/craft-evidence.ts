import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '../..')
const outputPath = resolve(root, 'protocol/evidence/craft.json')

export const craftEvidence = {
  schemaVersion: 1,
  status: 'source-verified-ci-pending',
  source: {
    repository: 'https://github.com/home-lang/craft',
    version: '0.0.44',
    tag: 'v0.0.44',
    revision: 'ddd23c70e6208d4a182bde4cae2ff0e6aefe3ec1',
  },
  issues: {
    support: 'https://github.com/stacksjs/stacks/issues/2059',
    signing: 'https://github.com/stacksjs/stacks/issues/2062',
    lifecycle: 'https://github.com/stacksjs/stacks/issues/2063',
    upstreamActions: 'https://github.com/home-lang/craft/issues/11',
  },
  contracts: [
    { path: 'packages/typescript/src/package.ts', sha256: '007a2f0c7a8406ba01b0d8e1ac50db1ad58c674209d84e1f3eebce0723ca4b10' },
    { path: 'packages/typescript/src/package.test.ts', sha256: 'a6f31bdf56014c8423d702af5dc7da12d9ecea49dd138464414c0dbfa7276849' },
    { path: 'scripts/native-lifecycle.ts', sha256: '17768caa805a9adad975349a388cb90196c8047d526b84b0ad24e1773da629a6' },
    { path: '.github/workflows/native-lifecycle.yml', sha256: '493b614554f03dc669724ff31bd56ae8361851dd2a9b32ac37560d9c0bb1b85e' },
    { path: '.github/workflows/release.yml', sha256: 'e3c7edd45841a7260fb4dfe810f0ff3f63f3117f7d0f4d14984e4dfb36b1f638' },
  ],
  lifecycleMatrix: [
    { runner: 'macos-15', platform: 'darwin', architecture: 'arm64', formats: ['dmg', 'pkg'] },
    { runner: 'macos-15-intel', platform: 'darwin', architecture: 'x64', formats: ['dmg', 'pkg'] },
    { runner: 'ubuntu-24.04', platform: 'linux', architecture: 'x64', formats: ['deb'] },
    { runner: 'windows-2025', platform: 'win32', architecture: 'x64', formats: ['msi', 'zip'] },
  ],
  lifecycleOperations: ['install', 'launch', 'update', 'rollback', 'uninstall'],
  stacksWorkflow: 'https://github.com/stacksjs/stacks/actions/workflows/desktop-lifecycle.yml',
  release: {
    sourceTagged: true,
    githubRelease: null,
    packagePublished: false,
    signing: 'pending',
    notarization: 'pending',
    blockedBy: 'https://github.com/home-lang/craft/issues/11',
  },
  verification: {
    local: ['bun test packages/typescript/src/package.test.ts', 'bun run typecheck', 'bun scripts/native-lifecycle.ts'],
    retained: 'pending first successful stacksjs/stacks desktop-lifecycle run',
  },
} as const

export function validateCraftEvidence(evidence: typeof craftEvidence): string[] {
  const errors: string[] = []
  if (evidence.source.tag !== `v${evidence.source.version}`) errors.push('Craft tag does not match its version')
  if (!/^[a-f0-9]{40}$/.test(evidence.source.revision)) errors.push('Craft revision is not a full commit SHA')
  if (evidence.contracts.length !== 5) errors.push('all Craft packaging/release contracts must be pinned')
  for (const contract of evidence.contracts) {
    if (!/^[a-f0-9]{64}$/.test(contract.sha256)) errors.push(`${contract.path}: invalid SHA-256 digest`)
  }
  const targets = new Set(evidence.lifecycleMatrix.map(row => `${row.platform}/${row.architecture}`))
  for (const target of ['darwin/arm64', 'darwin/x64', 'linux/x64', 'win32/x64']) {
    if (!targets.has(target)) errors.push(`Craft lifecycle matrix is missing ${target}`)
  }
  if (evidence.release.signing !== 'pending' || evidence.release.notarization !== 'pending')
    errors.push('Craft signing/notarization cannot be promoted without retained release evidence')
  if (!evidence.release.blockedBy) errors.push('Craft release blocker must be linked')
  return errors
}

function serializedEvidence(): string {
  return `${JSON.stringify(craftEvidence, null, 2)}\n`
}

if (import.meta.main) {
  const errors = validateCraftEvidence(craftEvidence)
  if (process.argv.includes('--write')) {
    if (errors.length) throw new Error(errors.join('\n'))
    writeFileSync(outputPath, serializedEvidence())
    console.log(`Wrote Craft evidence for ${craftEvidence.source.tag}`)
  }
  else if (process.argv.includes('--check')) {
    if (!existsSync(outputPath)) errors.push('protocol/evidence/craft.json is missing')
    else if (readFileSync(outputPath, 'utf8') !== serializedEvidence()) errors.push('Craft evidence is stale; run bun run protocol:craft')
    if (errors.length) throw new Error(errors.join('\n'))
    console.log(`Craft evidence pins ${craftEvidence.source.tag} at ${craftEvidence.source.revision}`)
  }
  else {
    console.error('usage: bun scripts/protocol/craft-evidence.ts --write | --check')
    process.exit(2)
  }
}
