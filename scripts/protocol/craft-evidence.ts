import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '../..')
const outputPath = resolve(root, 'protocol/evidence/craft.json')

export const craftEvidence = {
  schemaVersion: 1,
  status: 'source-verified-ci-pending',
  source: {
    repository: 'https://github.com/home-lang/craft',
    version: '0.0.46',
    tag: 'v0.0.46',
    revision: '83cd0270a5e1118fa975f381e835bb0f8aee4baf',
  },
  issues: {
    support: 'https://github.com/stacksjs/stacks/issues/2059',
    signing: 'https://github.com/stacksjs/stacks/issues/2062',
    lifecycle: 'https://github.com/stacksjs/stacks/issues/2063',
    upstreamActions: 'https://github.com/home-lang/craft/issues/11',
  },
  contracts: [
    { path: 'packages/typescript/src/package.ts', sha256: '967ece5fcf7d77359bb7c4133abd56548e00897c8a41cb43b2ee03e62577e401' },
    { path: 'packages/typescript/src/package.test.ts', sha256: '4d7005d13a4c47ce61da26bf4b775b1659b44a06346b176a500b0b6b3ec78b4a' },
    { path: 'scripts/native-lifecycle.ts', sha256: 'a2c0af2c2165981ca7fbd31880adeec64db64fc305d4ca3efe62a11483b289b4' },
    { path: 'scripts/native-lifecycle-plan.ts', sha256: 'ac8e8f101246e94c0c26fdcbf9202536426bf192a303606079273d9689e4e27d' },
    { path: 'scripts/native-lifecycle-plan.test.ts', sha256: '5cc839b60f7c8e32716f29201b159af817f4ac40b2c7963131124b3ac5de0638' },
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
    local: ['bun test packages/typescript/src/package.test.ts scripts/native-lifecycle-plan.test.ts', 'bun run typecheck', 'bun scripts/native-lifecycle.ts'],
    retained: 'pending first successful stacksjs/stacks desktop-lifecycle run',
  },
} as const

export function validateCraftEvidence(evidence: typeof craftEvidence): string[] {
  const errors: string[] = []
  if (evidence.source.tag !== `v${evidence.source.version}`) errors.push('Craft tag does not match its version')
  if (!/^[a-f0-9]{40}$/.test(evidence.source.revision)) errors.push('Craft revision is not a full commit SHA')
  if (evidence.contracts.length !== 7) errors.push('all Craft packaging/release contracts must be pinned')
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
