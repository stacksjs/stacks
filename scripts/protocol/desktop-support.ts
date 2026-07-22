import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { desktopSupportMatrix } from '../../storage/framework/core/desktop/src/support'

const root = resolve(import.meta.dir, '../..')
const outputPath = resolve(root, 'protocol/evidence/desktop-support.json')
const document = {
  schemaVersion: '1.0.0',
  generatedFrom: 'storage/framework/core/desktop/src/support.ts',
  stableTargets: desktopSupportMatrix.filter(row => row.status === 'stable').length,
  externalGates: [
    'https://github.com/stacksjs/stacks/issues/2059',
    'https://github.com/stacksjs/stacks/issues/2062',
    'https://github.com/stacksjs/stacks/issues/2063',
  ],
  targets: desktopSupportMatrix,
}
const expected = `${JSON.stringify(document, null, 2)}\n`

if (process.argv.includes('--write')) {
  writeFileSync(outputPath, expected)
  console.log(`Wrote desktop support matrix (${document.stableTargets} stable targets)`)
}
else if (process.argv.includes('--check')) {
  if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== expected)
    throw new Error('desktop support evidence is stale; run bun run protocol:desktop')
  if (document.targets.some(row => row.status === 'stable' && (!row.installLaunchEvidence || !row.updateRollbackEvidence || row.signing !== 'enforced')))
    throw new Error('stable desktop target lacks required evidence')
  console.log(`Desktop support matrix is current (${document.stableTargets} stable targets)`)
}
else {
  console.error('usage: bun scripts/protocol/desktop-support.ts --write | --check')
  process.exit(2)
}
