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
import {objectKeys,objectEntries,objectMap,getPath,mapValues,deepMerge} from '@stacksjs/objects'
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
const changed=setPath({balance:1},['balance'],'oops')
const newBalance:string=changed.balance
// @ts-expect-error replacing a value drops its original type
const oldBalance:number=changed.balance
const nested=setPath({a:{old:true}},['a','new'],42)
const added:number=nested.a.new
const sibling:boolean=nested.a.old
const built=setPath({},['items',0,'name'],'Alice')
const name:string=built.items[0]!.name
const numericToText=setPath({1:123},['1'],'oops')
const textToNumeric=setPath({'1':123},[1],'oops')
const aliasOne:string=numericToText[1]
const aliasTwo:string=textToNumeric['1']
// @ts-expect-error JavaScript numeric and string property names identify the same key
const staleOne:number=numericToText[1]
// @ts-expect-error the reverse spelling also replaces the old numeric value
const staleTwo:number=textToNumeric['1']
const truncated=setPath([1,'two'] as const,['length'],0)
// @ts-expect-error truncation removes tuple index guarantees
const present:1=truncated[0]
const chosen:'a'|'b'=Math.random()<0.5?'a':'b'
const oneChanged=setPath({a:1,b:2},[chosen],'text')
const either:number|string=oneChanged.a
// @ts-expect-error a union step changes only one of the possible fields
oneChanged.a.toUpperCase()
const optionalInput:{}|{nested:{old:number}}={}
const optionalResult=setPath(optionalInput,['nested','new'],true)
const optionalNew:boolean=optionalResult.nested.new
function broadStep(key:string) {
  const arbitrary=setPath({a:1,b:2},[key],'text')
  // @ts-expect-error a broad step cannot promise every key changed
  const unsafe:string=arbitrary.b
  const nested=setPath({child:{a:1}},['child',key],'text')
  // @ts-expect-error a nested broad step also needs narrowing
  nested.child.a.toUpperCase()
}
function patternedStep(key:\`field:\${string}\`) {
  const result=setPath({'field:a':1,'field:b':2},[key],'text')
  // @ts-expect-error an open template pattern does not change every matching field
  result['field:b'].toUpperCase()
}
function numericPattern(key:\`\${number}\`) {
  const result=setPath({1:1,2:2},[key],'text')
  // @ts-expect-error an open numeric pattern does not change every matching field
  result[2].toUpperCase()
}
const numbered=Object.assign([1],{'-1':'negative','1.5':'fraction','01':'leading','4294967295':'edge'})
const siblingNames=setPath(numbered,[0],2)
const negative:string=siblingNames[-1]
const fraction:string=siblingNames[1.5]
const leading:string=siblingNames['01']
const edge:string=siblingNames[4294967295]
// @ts-expect-error a numeric-looking named sibling is still a string
siblingNames[-1]?.toFixed()
const replacedName=setPath(numbered,[-1],true)
const updatedNegative:boolean=replacedName[-1]
// @ts-expect-error replacing a named sibling drops its old type
const oldNegative:string=replacedName[-1]
const indexedInput:Record<string,number>={a:1}
const indexedResult=setPath(indexedInput,['a'],'text')
const arbitraryKey:string='a'
// @ts-expect-error changing a record cannot preserve its old index-signature promise
const staleIndex:number=indexedResult[arbitraryKey]
const root:string=setPath({old:1},[],'replacement')
const list=setPath([1,2], [0], 'text')
const item:number|string=list[0]!
// @ts-expect-error array values may have been replaced
const oldItem:number=list[0]!
const tuple=setPath([1,'two'] as const,[0],true)
const first:boolean=tuple[0]
const second:'two'=tuple[1]
const arbitraryPath:string[]=['name']
const dynamic:unknown=setPath({name:'Alice'},arbitraryPath,42)
// @ts-expect-error a dynamic path cannot promise the source shape
setPath({name:'Alice'},arbitraryPath,42).name.toUpperCase()
const mapped=objectMap({account:'owner'},()=>undefined as ['account',string]|undefined)
const optionalAccount:string|undefined=mapped.account
// @ts-expect-error a filtering callback can omit the key
const guaranteedAccount:string=mapped.account
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
