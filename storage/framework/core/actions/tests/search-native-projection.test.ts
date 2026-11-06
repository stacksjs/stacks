import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('search actions preserve an empty selector and bootstrap native batch projections', async () => {
  const checkout = resolve(import.meta.dir, '../../../../..')
  const root = mkdtempSync(join(tmpdir(), 'stacks-native-search-cli-'))
  const collections = new Map<string, { name: string, fields: any[], documents: any[] }>()
  const provider = Bun.serve({ port: 0, async fetch(request) {
    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    if (request.headers.get('x-typesense-api-key') !== 'fixture-key') return Response.json({}, { status: 401 })
    if (request.method === 'POST' && parts.length === 1) {
      const body = await request.json() as any
      collections.set(body.name, { ...body, documents: [] })
      return Response.json(body)
    }
    const collection = collections.get(parts[1]!)
    if (!collection) return Response.json({ message: 'Not Found' }, { status: 404 })
    if (request.method === 'GET') return Response.json(collection)
    if (request.method === 'PATCH') {
      const patch = await request.json() as any
      for (const field of patch.fields) {
        collection.fields = collection.fields.filter(value => value.name !== field.name)
        if (!field.drop) collection.fields.push(field)
      }
      return Response.json(collection)
    }
    if (request.method === 'POST' && parts[3] === 'import') {
      const rows = (await request.text()).trim().split('\n').map(line => JSON.parse(line))
      collection.documents.push(...rows)
      return new Response(rows.map(() => JSON.stringify({ success: true })).join('\n'))
    }
    return Response.json({ message: 'Unexpected provider request' }, { status: 500 })
  } })
  try {
    for (const path of ['app/Models/nested', 'config', 'storage/framework/core']) mkdirSync(join(root, path), { recursive: true })
    symlinkSync(join(checkout, 'node_modules'), join(root, 'node_modules'))
    symlinkSync(join(checkout, 'storage/framework/core/actions'), join(root, 'storage/framework/actions'))
    symlinkSync(join(checkout, 'storage/framework/core/actions'), join(root, 'storage/framework/core/actions'))
    writeFileSync(join(root, 'package.json'), '{"name":"native-search-cli-fixture","type":"module"}')
    writeFileSync(join(root, 'bunfig.toml'), '')
    const source = (pkg: string) => join(checkout, 'storage/framework/core', pkg, 'src')
    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { paths: {
      '@stacksjs/actions': [join(source('actions'), 'index.ts')],
      '@stacksjs/actions/*': [join(source('actions'), '*.ts')],
      '@stacksjs/search-engine': [join(source('search-engine'), 'index.ts')],
      '@stacksjs/orm': [join(source('orm'), 'index.ts')],
      '@stacksjs/orm/*': [join(source('orm'), '*.ts')],
      '@stacksjs/server': [join(source('server'), 'index.ts')],
    } } }))
    writeFileSync(join(root, 'config/database.ts'), `export default {default:'sqlite',connections:{sqlite:{database:${JSON.stringify(join(root, 'fixture.sqlite'))}}},models:{includeFrameworkDefaults:false}}`)
    writeFileSync(join(root, 'config/search-engine.ts'), `export default {driver:'typesense',typesense:{host:'127.0.0.1',port:${provider.port},protocol:'http',apiKey:'fixture-key'}}`)
    writeFileSync(join(root, 'config/cms.ts'), 'export default {enabled:false}')
    writeFileSync(join(root, 'app/Models/Post.ts'), `export default {name:'Post',table:'posts',attributes:{},traits:{useSearch:true},all:async()=>[],makeAllSearchable:async()=>{throw Error('disabled CMS model was indexed')}}`)
    writeFileSync(join(root, 'app/Models/nested/Thing.ts'), `
      import {defineModel} from '@stacksjs/orm/define-model'
      import {schema} from '@stacksjs/validation/runtime'
      export default defineModel({name:'Thing',table:'things',primaryKey:'id',autoIncrement:true,
        attributes:{name:{validation:{rule:schema.string()}},private_token:{hidden:true,validation:{rule:schema.string()}}},
        traits:{useTimestamps:false,useSearch:{index:'native_thing_search',searchable:['name'],displayable:['id','name'],
          shapeMany:async models=>{
            const rows=await db.selectFrom('things').select(['id','name']).where('id','in',models.map(row=>row.id)).execute()
            return rows.map(row=>({id:String(row.id),name:row.name}))
          }}}
      })`)
    const database = new Database(join(root, 'fixture.sqlite'))
    database.exec("CREATE TABLE things (id INTEGER PRIMARY KEY, name TEXT, private_token TEXT); INSERT INTO things VALUES (1,'first','private-token'),(2,'second','private-token')")
    database.close()
    const run = async (action: string, model: string) => {
      const file = join(root, 'run.ts')
      writeFileSync(file, `import {runAction} from ${JSON.stringify(join(source('actions'), 'helpers/utils.ts'))}; const result=await runAction(${JSON.stringify(action)},{cwd:${JSON.stringify(root)},model:${JSON.stringify(model)},verbose:true}); process.exit(result.isErr?1:0)`)
      const child = Bun.spawn([process.execPath, '--no-env-file', `--config=${join(root, 'bunfig.toml')}`, file], {
        cwd: root, env: { ...process.env, APP_ENV: 'test', NODE_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(root, 'fixture.sqlite'), STACKS_DASHBOARD_WORKER: '0' },
        stdout: 'pipe', stderr: 'pipe',
      })
      const timeout = setTimeout(() => child.kill(), 20000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        return { code, output: stdout + stderr }
      }
      finally { clearTimeout(timeout); child.kill() }
    }
    const imported = await run('search/import', '')
    expect(imported.code, imported.output).toBe(0)
    expect(collections.get('native_thing_search')?.documents).toEqual([{ id: '1', name: 'first' }, { id: '2', name: 'second' }])
    const settings = await run('search/settings-list', '')
    expect(settings.code, settings.output).toBe(0)
    expect(settings.output).toContain('native_thing_search')
    const missing = await run('search/import', 'Missing')
    expect(missing.code).not.toBe(0)
    expect(missing.output).toContain('not found')
  }
  finally { await provider.stop(true); rmSync(root, { recursive: true, force: true }) }
}, 65000)
