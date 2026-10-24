import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('reindex uses nested app models without importing excluded framework defaults', () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-search-scope-'))
  try {
    mkdirSync(join(root, 'app/Models/nested'), { recursive: true })
    mkdirSync(join(root, 'storage/framework/defaults/app/Models'), { recursive: true })
    writeFileSync(join(root, 'package.json'), '{"name":"search-scope-fixture","type":"module"}')
    writeFileSync(join(root, 'bunfig.toml'), '')
    writeFileSync(join(root, 'app/Models/nested/Thing.ts'), `export default {name:'Thing',table:'things',traits:{useSearch:true},all:async()=>[],makeAllSearchable:async()=>{console.log('APP_MODEL_INDEXED');return 7}}`)
    for (const name of ['Thing', 'Demo']) writeFileSync(join(root, `storage/framework/defaults/app/Models/${name}.ts`), 'throw Error("excluded default was imported"); export default {}')
    const mock = join(root, 'mock.ts')
    writeFileSync(mock, `import {mock} from 'bun:test'; mock.module('@stacksjs/search-engine',()=>({useSearchEngine:()=>({addDocument:async()=>{},updateSettings:async()=>{}})}));`)
    const action = new URL('../src/documents/add.ts', import.meta.url).pathname
    const child = Bun.spawnSync([process.execPath, '--preload', mock, '-e', `import {importModelDocuments} from ${JSON.stringify(action)};const result=await importModelDocuments('Thing');if(result.isErr){console.error(result.error);process.exit(1)}process.exit(0)`], {
      cwd: root, env: { ...process.env, STACKS_INCLUDE_FRAMEWORK_MODELS: 'false' }, stdout: 'pipe', stderr: 'pipe',
    })
    expect(child.exitCode, child.stderr.toString()).toBe(0)
    expect(child.stderr.toString()).not.toContain('excluded default was imported')
    expect(child.stdout.toString()).toContain('APP_MODEL_INDEXED')
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 30_000)
