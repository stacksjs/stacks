import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { disableFeature, feature } from '@stacksjs/config'
import { featureGatedMigrationFiles } from '../../src/migrations'

const original = process.cwd()
mkdirSync(join(original, 'storage/framework/runtime'), { recursive: true })
const root = mkdtempSync(join(original, 'storage/framework/runtime/model-ownership-'))
const defaults = join(original, 'storage/framework/defaults')
const inherited = join(defaults, 'app/Models/Request.ts')
disableFeature('dashboard')

async function check(name: string, model: string | null, expected: string[], nested = false): Promise<void> {
  const project = join(root, name)
  const models = join(project, 'app/Models', nested ? 'Monitoring' : '')
  const migrations = join(project, 'database/migrations')
  mkdirSync(models, { recursive: true })
  mkdirSync(migrations, { recursive: true })
  mkdirSync(join(project, 'storage/framework'), { recursive: true })
  symlinkSync(defaults, join(project, 'storage/framework/defaults'))
  if (model !== null) writeFileSync(join(models, 'Request.ts'), model)
  const filename = '0000000001-create-requests-table.sql'
  writeFileSync(join(migrations, filename), 'CREATE TABLE requests (id INTEGER);')
  process.chdir(project)
  assert.equal(feature('dashboard'), false)
  const gated = await featureGatedMigrationFiles(migrations)
  assert.deepEqual(gated.map(entry => entry.file), expected.map(() => filename), name)
  assert.equal(feature('dashboard'), false, 'model ownership must not enable the UI')
}

try {
  await check('spread', `import base from '${inherited}'\nexport default { ...base, dashboard: { access: false } }\n`, [])
  await check('define-model', `import { defineModel } from '@stacksjs/orm'\nimport base from '${inherited}'\nexport default defineModel({ ...base, dashboard: { access: false } })\n`, [])
  await check('extend-model', `import { extendModel } from '@stacksjs/orm'\nimport base from '${inherited}'\nexport default extendModel(base, { dashboard: { access: false } })\n`, [])
  await check('reexport', `export { default } from '${inherited}'\n`, [])
  await check('nested', `import base from '${inherited}'\nexport default { ...base }\n`, [], true)
  await check('override', `import base from '${inherited}'\nexport default { ...base, table: 'app_requests' }\n`, ['requests'])
  await check('unused-import', `import base from '${inherited}'\n// table: 'requests'\nexport default { name: 'Other', table: 'other_records' }\n`, ['requests'])
  await check('missing', null, ['requests'])
  await check('scaffold', await Bun.file(inherited).text(), ['requests'])
  console.log('app model migration ownership OK')
}
finally {
  process.chdir(original)
  rmSync(root, { recursive: true, force: true })
}
