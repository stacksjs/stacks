import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('published callback and JSON declarations match runtime contracts', async () => {
  const root = resolve(import.meta.dir, '..')
  const built = Bun.spawnSync([process.execPath, 'run', 'build'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  expect(built.exitCode, built.stderr.toString()).toBe(0)
  const directory = await mkdtemp(join(tmpdir(), 'stacks-utility-consumer-'))
  try {
    await mkdir(join(directory, 'node_modules/@stacksjs'), { recursive: true })
    await symlink(root, join(directory, 'node_modules/@stacksjs/utils'), 'dir')
    await writeFile(join(directory, 'consumer.ts'), `
import {debounce,throttle} from '@stacksjs/utils/debounce'
import {safeJsonStringify} from '@stacksjs/utils/safe-json'
const d=debounce((value:number)=>value+1,100)
const result:number|undefined=d(1)
const flushed:number|undefined=d.flush()
// @ts-expect-error a deferred call has no result yet
const unsoundCall:number=d(1)
// @ts-expect-error an idle flush may have no result
const unsoundFlush:number=d.flush()
const t=throttle((value:number)=>String(value),100)
const throttled:string|undefined=t(1)
// @ts-expect-error throttled results are strings, not numbers
const wrong:number=t(1)
const a=debounce(async (value:number)=>value,100)
const promise:Promise<number>|undefined=a.flush()
const owner={value:1, run:debounce(function(this:{value:number},add:number){return this.value+add},100)}
owner.run(2)
// @ts-expect-error callback receiver is required
owner.run.call({},2)
const json:string|undefined=safeJsonStringify(undefined)
// @ts-expect-error unsupported JSON roots return undefined
const required:string=safeJsonStringify(undefined)
`)
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, skipLibCheck: true, preserveSymlinks: true, module: 'esnext', moduleResolution: 'bundler', target: 'esnext', types: [] }, files: ['consumer.ts'] }))
    const checked = Bun.spawnSync([resolve(root, '../../../../node_modules/.bin/tsc'), '--noEmit', '-p', join(directory, 'tsconfig.json')], { stdout: 'pipe', stderr: 'pipe' })
    expect(checked.exitCode, checked.stdout.toString() + checked.stderr.toString()).toBe(0)
    const runtime = Bun.spawnSync([process.execPath, '--no-env-file', '-e', `
const {debounce,throttle}=await import('@stacksjs/utils/debounce')
const {safeJsonStringify}=await import('@stacksjs/utils/safe-json')
const d=debounce(n=>n+1,100)
if(d(2)!==undefined||d.flush()!==3)throw new Error('Published debounce result mismatch')
d.cancel()
const t=throttle(()=>42,100)
if(t()!==42)throw new Error('Published throttle result mismatch')
t.cancel()
const shared={id:1}
if(safeJsonStringify({a:shared,b:shared})!=='{"a":{"id":1},"b":{"id":1}}'||safeJsonStringify(undefined)!==undefined)throw new Error('Published JSON mismatch')
`], { cwd: directory, stdout: 'pipe', stderr: 'pipe' })
    expect(runtime.exitCode, runtime.stderr.toString()).toBe(0)
  }
  finally { await rm(directory, { recursive: true, force: true }) }
}, 30_000)
