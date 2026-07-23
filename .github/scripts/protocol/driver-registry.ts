import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { capabilityRegistry } from '../../../storage/framework/core/config/src/capabilities'

const root = resolve(import.meta.dir, '../../..')
const outputPath = resolve(root, '.github/protocol/evidence/drivers.json')

function validate(): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  const categories = new Set(['database', 'queue', 'cache', 'storage', 'mail', 'realtime', 'deploy'])
  for (const driver of capabilityRegistry) {
    const id = `${driver.category}/${driver.name}`
    if (seen.has(id)) errors.push(`${id}: duplicate registry entry`)
    seen.add(id)
    if (!categories.has(driver.category)) errors.push(`${id}: unknown category`)
    if (driver.status === 'supported' && driver.testEvidence.length === 0) errors.push(`${id}: supported driver has no test evidence`)
    if (driver.status === 'supported' && /client-server|managed|smtp|redis/.test(driver.topology) && !driver.liveServiceContract)
      errors.push(`${id}: externally hosted driver cannot be supported without a retained live-service contract`)
    if (driver.liveServiceContract && !existsSync(resolve(root, driver.liveServiceContract.workflow)))
      errors.push(`${id}: live-service workflow does not exist: ${driver.liveServiceContract.workflow}`)
    if (driver.status !== 'supported' && driver.limitations.length === 0) errors.push(`${id}: non-supported driver must explain its evidence gap`)
    if (driver.status !== 'unsupported' && !driver.implementation) errors.push(`${id}: operational driver has no implementation`)
    if (driver.implementation && !existsSync(resolve(root, driver.implementation))) errors.push(`${id}: implementation path does not exist`)
    for (const testPath of driver.testEvidence) {
      if (!existsSync(resolve(root, testPath))) errors.push(`${id}: test evidence does not exist: ${testPath}`)
    }
  }
  for (const category of categories) {
    if (!capabilityRegistry.some(driver => driver.category === category)) errors.push(`${category}: no drivers registered`)
  }
  return errors
}

function render(): string {
  const document = {
    schemaVersion: '1.0.0',
    generatedFrom: 'storage/framework/core/config/src/capabilities.ts',
    resultSemantics: {
      supported: 'Implemented, selected by configuration, and backed by checked-in automated evidence.',
      partial: 'Implemented, but missing live-service or feature-parity evidence.',
      experimental: 'Implemented for evaluation without a compatibility commitment or complete matrix.',
      unsupported: 'Reserved, planned, or intentionally unavailable; selection must fail loudly.',
    },
    drivers: [...capabilityRegistry].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
  }
  return `${JSON.stringify(document, null, 2)}\n`
}

if (import.meta.main) {
  const errors = validate()
  if (errors.length > 0) {
    for (const error of errors) console.error(`error: ${error}`)
    process.exit(1)
  }
  const expected = render()
  if (process.argv.includes('--write')) {
    writeFileSync(outputPath, expected)
    console.log(`Wrote ${capabilityRegistry.length} driver capability records`)
  }
  else if (process.argv.includes('--check')) {
    if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== expected)
      throw new Error('driver registry evidence is stale; run bun run protocol:drivers')
    console.log(`Driver registry is current (${capabilityRegistry.length} records)`)
  }
  else {
    console.error('usage: bun .github/scripts/protocol/driver-registry.ts --write | --check')
    process.exit(2)
  }
}
