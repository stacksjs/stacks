import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { prepareMigrationModelsDir } from '../../src/migrations'
import { cleanupModelStaging, resolveModelSources } from '../../src/model-sources'

try {
  const resolved = resolveModelSources()
  assert(resolved)
  assert(resolved.models.length > 55)
  assert(resolved.models.some(model => model.name === 'PrintDevice'))
  assert(existsSync(resolved.dir))
  assert.equal(readdirSync(resolved.dir).filter(file => file.endsWith('.ts')).length, resolved.models.length)
  const prepared = prepareMigrationModelsDir()
  assert.equal(prepared.skip, false)
  assert(existsSync(prepared.modelsDir))
  assert(readdirSync(prepared.modelsDir).includes('User.ts'))
  console.log('default model discovery OK')
}
finally { cleanupModelStaging() }
