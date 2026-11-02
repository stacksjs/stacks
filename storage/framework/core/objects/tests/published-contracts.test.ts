import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('built object exports and declarations agree in an isolated consumer', async () => {
  const root = resolve(import.meta.dir, '..')
  const builtTypes = Bun.spawnSync([process.execPath, 'run', 'build'], { cwd: resolve(root, '../types'), stdout: 'pipe', stderr: 'pipe' })
  expect(builtTypes.exitCode, builtTypes.stderr.toString()).toBe(0)
  const built = Bun.spawnSync([process.execPath, 'run', 'build'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  expect(built.exitCode, built.stderr.toString()).toBe(0)
  const directory = await mkdtemp(join(tmpdir(), 'stacks-object-consumer-'))
  try {
    await mkdir(join(directory, 'node_modules/@stacksjs'), { recursive: true })
    await symlink(root, join(directory, 'node_modules/@stacksjs/objects'), 'dir')
    await symlink(resolve(root, '../types'), join(directory, 'node_modules/@stacksjs/types'), 'dir')
    await writeFile(join(directory, 'consumer.ts'), `
import {objectKeys,objectEntries,getPath,mapValues,deepMerge} from '@stacksjs/objects'
import {setPath} from '@stacksjs/objects/transform'
const tag=Symbol('tag')
const input={a:1,1:'one',[tag]:true}
const keys:Array<'a'|'1'>=objectKeys(input)
const entry=objectEntries(input)[0]!
const key:'a'|'1'=entry[0]
const value:string|number=entry[1]
// @ts-expect-error numeric property names are serialized as strings
const numericKey:1=entry[0]
// @ts-expect-error a fallback does not determine an existing value's type
const unsound:number=getPath({name:'Alice'},['name'],0)
const optional=mapValues({a:1} as {a?:number,[tag]?:number},v=>String(v))
const maybe:string|undefined=optional.a
// @ts-expect-error symbol entries are not visited by mapValues
const absent:string=optional[tag]
setPath([1,2,3],['length'],1)
const merged=deepMerge({number:1,nested:{left:'left'},date:new Date(0)},{number:2,nested:{right:true},date:{enabled:true}})
const n:number=merged.number
const left:string=merged.nested.left
const right:boolean=merged.nested.right
const enabled:boolean=merged.date.enabled
// @ts-expect-error a replaced Date target no longer has Date methods
merged.date.toISOString()
deepMerge({}, {date:new Date(0)}).date.toISOString()
const replaced:string[]=deepMerge({list:[1]},{list:['x']}).list
const optionalSource:{value?:string}={}
const retained:number|string|undefined=deepMerge({value:1},optionalSource).value
// @ts-expect-error an absent optional source can leave the target's number
deepMerge({value:1},optionalSource).value?.toUpperCase()
const replacedURL=deepMerge({value:new URL('https://example.test')},{value:{enabled:true}}).value
const urlEnabled:boolean=replacedURL.enabled
// @ts-expect-error replacing a URL drops its prototype properties
replacedURL.href.toUpperCase()
const replacedError=deepMerge({value:new Error('old')},{value:{enabled:true}}).value
// @ts-expect-error replacing an Error drops its prototype properties
replacedError.message.toUpperCase()
`)
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, skipLibCheck: true, preserveSymlinks: true, module: 'esnext', moduleResolution: 'bundler', target: 'esnext', types: [] }, files: ['consumer.ts'] }))
    const checked = Bun.spawnSync([resolve(root, '../../../../node_modules/.bin/tsc'), '--noEmit', '-p', join(directory, 'tsconfig.json')], { stdout: 'pipe', stderr: 'pipe' })
    expect(checked.exitCode, checked.stdout.toString() + checked.stderr.toString()).toBe(0)
    const runtime = Bun.spawnSync([process.execPath, '--no-env-file', '-e', `
const {setPath,getPath}=await import('@stacksjs/objects/transform')
if(JSON.stringify(setPath([1,2,3],['length'],1))!=='[1]')throw new Error('Published array update failed')
if(getPath({name:'Alice'},['name'],0)!=='Alice')throw new Error('Published path read failed')
`], { cwd: directory, stdout: 'pipe', stderr: 'pipe' })
    expect(runtime.exitCode, runtime.stderr.toString()).toBe(0)
  }
  finally { await rm(directory, { recursive: true, force: true }) }
}, 30_000)
