import { afterEach, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { retainLibraryRelease } from '../src/library/release-artifacts'
import { publishPreparedLibraryRelease, readbackLibraryRelease } from '../src/library/release-registry'

// Public retention/readback/publisher seams catch unusable manifests, mutable
// tags and real process deadlines; they do not qualify a live registry account.
const roots: string[] = []
const source = { repository: 'example/libraries', commit: 'a'.repeat(40) }
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })

async function fixture(exports: unknown = './dist/index.js') {
  const root = await mkdtemp(join(tmpdir(), 'stacks-release-boundaries-'))
  roots.push(root)
  const dir = join(root, 'node_modules/@example/boundary')
  await mkdir(join(dir, 'dist'), { recursive: true })
  await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  await writeFile(join(root, 'bunfig.toml'), 'preload = []\n')
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: '@example/boundary', version: '1.0.0-alpha.1', type: 'module', files: ['dist'], exports, main: 'dist/index.js', module: 'dist/index.js', types: 'dist/index.d.ts' }))
  await writeFile(join(dir, 'dist/index.js'), 'export const answer = 42\n')
  await writeFile(join(dir, 'dist/index.d.ts'), 'export declare const answer: 42\n')
  const plan = { name: '@example/boundary', version: '1.0.0-alpha.1', dir, registry: 'npm' as const, access: 'public' as const, tarballFiles: 2 }
  return { root, dir, plan, directory: join(root, 'candidate') }
}

test('rejects an export target which exists in the archive but is invalid for a Node package import', async () => {
  const { root, plan, directory } = await fixture('dist/index.js')
  const node = Bun.which('node')
  expect(node).not.toBeNull()
  const consumer = Bun.spawnSync([node!, '--input-type=module', '-e', "await import('@example/boundary')"], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  expect(consumer.exitCode).not.toBe(0)
  expect(consumer.stderr.toString()).toContain('ERR_INVALID_PACKAGE_TARGET')
  await expect(retainLibraryRelease({ directory, source, tag: 'alpha', packages: [plan] })).rejects.toThrow('relative ./')
})

test.each([
  './dist/index.js',
  { import: ['./dist/index.js'], default: './dist/index.js' },
  { '.': { types: './dist/index.d.ts', import: ['./dist/index.js'], default: './dist/index.js' }, './features/*': './dist/*.js', './private': null },
])('retains valid string, conditional, array, wildcard and null exports with conventional manifest fields', async (exports) => {
  const { root, plan, directory } = await fixture(exports)
  const candidate = await retainLibraryRelease({ directory, source, tag: 'alpha', packages: [plan] })
  expect(candidate.packages[0]!.archive.files['dist/index.js']).toBeDefined()
  for (const runtime of [Bun.which('node')!, process.execPath]) {
    const subpaths = typeof exports === 'object' && './features/*' in exports
      ? "const feature=await import('@example/boundary/features/index');if(feature.answer!==42)throw new Error('Wrong wildcard export');const hidden=await import('@example/boundary/private').then(()=>false,()=>true);if(!hidden)throw new Error('Null export should deny access');"
      : ''
    const consumer = Bun.spawnSync([runtime, '--input-type=module', '-e', `const {answer}=await import('@example/boundary'); if(answer!==42) throw new Error('Wrong public export');${subpaths}`], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    expect(consumer.exitCode, consumer.stderr.toString()).toBe(0)
  }
})

test('historical readback can report advanced tags without weakening publication or archive identity', async () => {
  const { root, plan, directory } = await fixture()
  const candidate = await retainLibraryRelease({ directory, source, tag: 'alpha', packages: [plan] })
  const archive = await Bun.file(join(directory, candidate.packages[0]!.archive.path)).bytes()
  let tamper = false
  let uploads = 0
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    if (request.method !== 'GET') { uploads++; return new Response('', { status: 405 }) }
    if (new URL(request.url).pathname.endsWith('.tgz')) return new Response(tamper ? new Uint8Array([0]) : archive)
    if (new URL(request.url).pathname.endsWith(`/${plan.version}`)) return Response.json({ name: plan.name, version: plan.version, dist: { integrity: candidate.packages[0]!.archive.integrity, tarball: `${server.url.origin}/boundary.tgz` } })
    return Response.json({ 'dist-tags': { alpha: '1.0.0-alpha.2', latest: '1.0.0' } })
  } })
  try {
    const options = { npmRegistry: server.url.origin, requireCurrentTag: false, deadlineMs: 2000 }
    await expect(readbackLibraryRelease(directory, { npmRegistry: server.url.origin })).rejects.toThrow('tag alpha')
    const receipt = await readbackLibraryRelease(directory, options)
    expect(receipt.packages[0]!.version).toBe(plan.version)
    expect(receipt.packages[0]!.tags).toEqual({ alpha: '1.0.0-alpha.2', latest: '1.0.0' })
    let executed = false
    await expect(publishPreparedLibraryRelease(directory, { ...options, publisher: 'bun', execute: async () => { executed = true; return 0 } })).rejects.toThrow('refusing implicit tag mutation')
    expect(executed).toBe(false)
    expect(uploads).toBe(0)
    tamper = true
    await expect(readbackLibraryRelease(directory, options)).rejects.toThrow('archive bytes differ')
  }
  finally { server.stop(true) }
})

test.skipIf(process.platform === 'win32')('the default publisher deadline stops a SIGTERM-resistant publisher and its inherited child', async () => {
  const { root, plan, directory } = await fixture()
  await retainLibraryRelease({ directory, source, tag: 'alpha', packages: [plan] })
  const bin = join(root, 'bin'), home = join(root, 'home')
  await mkdir(bin); await mkdir(home)
  const executable = join(bin, 'npm'), pid = join(root, 'publisher.pid'), descendantPid = join(root, 'descendant.pid')
  const descendant = join(root, 'descendant.ts')
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch() { throw new Error('A dry-run must not contact even the owned registry') } })
  await writeFile(descendant, `process.on('SIGTERM',()=>{});await Bun.write(${JSON.stringify(descendantPid)},String(process.pid));setInterval(()=>{},1000)\n`)
  await writeFile(executable, `#!${process.execPath}\nif(!process.argv.includes('--dry-run')||process.argv[process.argv.indexOf('--registry')+1]!==${JSON.stringify(server.url.origin)})throw new Error('Expected local-only dry-run');process.on('SIGTERM',()=>{});const child=Bun.spawn([${JSON.stringify(process.execPath)},'--no-env-file',${JSON.stringify(descendant)}],{stdout:'inherit',stderr:'inherit'});await Bun.write(${JSON.stringify(pid)},String(process.pid));await child.exited\n`)
  await chmod(executable, 0o700)
  const probe = join(root, 'probe.ts')
  await writeFile(probe, `import {publishPreparedLibraryRelease} from ${JSON.stringify(join(import.meta.dir, '../src/library/release-registry.ts'))};
if(Bun.which('npm')!==${JSON.stringify(executable)})throw new Error('Wrong publisher executable');
const endpoint=new URL(${JSON.stringify(server.url.origin)});if(endpoint.hostname!=='127.0.0.1'||!endpoint.port)throw new Error('Expected owned loopback endpoint');
const started=performance.now();const operation=publishPreparedLibraryRelease(${JSON.stringify(directory)},{publisher:'npm',cwd:process.cwd(),dryRun:true,npmRegistry:endpoint.origin,requestTimeoutMs:400});
let watchdog;const outcome=await Promise.race([operation.then(()=>({settled:true,error:''})).catch(error=>({settled:true,error:String(error)})),new Promise(resolve=>{watchdog=setTimeout(()=>resolve({settled:false,error:''}),3000)})]);clearTimeout(watchdog);
const alive=[];for(const file of ${JSON.stringify([pid, descendantPid])}){if(!await Bun.file(file).exists())throw new Error('Publisher fixture did not start');const target=Number(await Bun.file(file).text());try{process.kill(target,0);alive.push(target)}catch{}}
console.log(JSON.stringify({...outcome,elapsed:performance.now()-started,alive}));for(const target of alive){try{process.kill(target,'SIGKILL')}catch{}}await operation.catch(()=>{});
`)
  try {
    const child = Bun.spawn([process.execPath, '--no-env-file', probe], { cwd: root, env: { PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home, BUN_OPTIONS: '', NODE_OPTIONS: '', NPM_TOKEN: '', NODE_AUTH_TOKEN: '', BUN_AUTH_TOKEN: '', NPM_CONFIG_USERCONFIG: join(home, '.npmrc'), NPM_CONFIG_CACHE: join(home, 'cache') }, stdout: 'pipe', stderr: 'pipe' })
    const [exit, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(exit, error).toBe(0)
    const result = JSON.parse(output.trim()) as { settled: boolean, elapsed: number, error: string, alive: number[] }
    expect(result.settled).toBe(true)
    expect(result.error).toBeTruthy()
    expect(result.elapsed).toBeLessThan(3000)
    expect(result.alive).toEqual([])
  }
  finally { server.stop(true) }
}, 10_000)
