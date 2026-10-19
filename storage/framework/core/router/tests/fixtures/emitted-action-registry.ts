import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const mode = Bun.argv[2], nativeRoutes = Bun.argv[3] === 'true'
assert(mode === 'source' || mode === 'emitted')
const directory = await mkdtemp(join(tmpdir(), 'stacks-emitted-actions-'))
const source = join(directory, 'source'), artifact = join(directory, 'artifact')
const original = process.cwd()
const actionClass = resolve(import.meta.dir, '../../../actions/src/action.ts')
const routerPath = resolve(import.meta.dir, '../../src/runtime.ts')
const registry = `export const actions = {
  'Actions/Ordinary': '../../../app/Actions/Ordinary.ts',
  'Actions/Nested/Detail': '../../../app/Actions/Nested/Detail.ts',
  'Actions/Broken': '../../../app/Actions/Broken.ts',
  'Actions/MissingDependency': '../../../app/Actions/MissingDependency.ts',
  'Actions/BrokenLink': '../../../app/Actions/BrokenLink.ts',
  'Actions/Nonregular': '../../../app/Actions/Nonregular.ts',
  'Actions/Outside': '../../../outside/Outside.ts',
  'Actions/OutsidePrefix': '../../../app/ActionsOther/Outside.ts',
  'Actions/Published': '@stacksjs/defaults/app/Actions/Published.ts',
}\n`
const body = (name: string) => `import { Action } from ${JSON.stringify(actionClass)}
export default new Action({ name: '${name}', method: 'GET', handle: () => ({ marker: '${name}', origin: import.meta.url }) })\n`
const plain = (marker: string) => `export default { handle: () => ({ marker: '${marker}', origin: import.meta.url }) }\n`
async function put(path: string, text: string) { await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, text) }
let server: { port: number, stop: (closeActiveConnections?: boolean) => unknown } | undefined
try {
  for (const name of ['Ordinary', 'Nested/Detail', 'NoRegistry']) await put(join(source, `app/Actions/${name}.ts`), body(name))
  await put(join(source, 'storage/framework/auto-imports/actions.ts'), registry)
  if (mode === 'emitted') {
    const root = join(source, 'app'), files: string[] = []
    for await (const file of new Bun.Glob('**/*.{ts,js}').scan({ cwd: root, onlyFiles: true })) files.push(file)
    // Actual native server app-build invocation, with owned roots/output only.
    const built = await Bun.build({ root, entrypoints: files.map(file => resolve(root, file)), outdir: join(artifact, 'app'), format: 'esm', target: 'bun', splitting: false, external: ['@swc/wasm'] })
    assert.equal(built.success, true, built.logs.map(String).join('\n'))
    await cp(join(source, 'storage'), join(artifact, 'storage'), { recursive: true })
    assert.equal(await readFile(join(artifact, 'storage/framework/auto-imports/actions.ts'), 'utf8'), registry)
    // The copied app has no source Action or resources tree to fall back to.
    await rm(source, { recursive: true, force: true })
  }
  const root = mode === 'source' ? source : artifact
  if (mode === 'source') {
    await put(join(root, 'app/Actions/Ordinary.js'), plain('wrong-emitted'))
    await put(join(root, 'app/Actions/Nested/Detail.js'), plain('wrong-nested-emitted'))
  }
  await mkdir(join(root, 'app/Actions'), { recursive: true })
  await put(join(root, 'app/Actions/Nonregular.js/index.js'), "globalThis.__emittedFallbackWasInvoked = true\n" + plain('unsafe-directory-fallback'))
  await symlink('./missing-source-target', join(root, 'app/Actions/BrokenLink.ts'))
  await put(join(root, 'app/Actions/BrokenLink.js'), "globalThis.__emittedFallbackWasInvoked = true\n" + plain('unsafe-link-fallback'))
  await put(join(root, 'app/Actions/Broken.ts'), "throw new Error('existing source failure must be retained')\n")
  await put(join(root, 'app/Actions/Broken.js'), "globalThis.__emittedFallbackWasInvoked = true\n" + plain('unsafe-fallback'))
  await put(join(root, 'app/Actions/MissingDependency.ts'), "import './missing-dependency-for-native-action'\n" + plain('missing-source'))
  await put(join(root, 'app/Actions/MissingDependency.js'), "globalThis.__emittedFallbackWasInvoked = true\n" + plain('unsafe-dependency-fallback'))
  await put(join(root, 'app/ActionsOther/Outside.js'), "globalThis.__emittedFallbackWasInvoked = true\n" + plain('unsafe-prefix-fallback'))
  await put(join(root, 'outside/Outside.js'), "globalThis.__emittedFallbackWasInvoked = true\n" + plain('unsafe-outside-fallback'))
  await put(join(root, 'storage/framework/defaults/app/Actions/NoRegistry.ts'), plain('wrong-default'))
  await put(join(root, 'node_modules/@stacksjs/defaults/package.json'), JSON.stringify({ name: '@stacksjs/defaults', type: 'module', exports: { './app/Actions/Published.ts': './app/Actions/Published.ts' } }))
  await put(join(root, 'node_modules/@stacksjs/defaults/app/Actions/Published.ts'), plain('packaged-default'))
  process.chdir(root)
  const { route } = await import(routerPath)
  for (const [path, action] of [['ordinary', 'Ordinary'], ['nested', 'Nested/Detail'], ['unregistered', 'NoRegistry'], ['broken', 'Broken'], ['missing', 'MissingDependency'], ['outside', 'Outside'], ['symlink', 'BrokenLink'], ['directory', 'Nonregular'], ['prefix', 'OutsidePrefix'], ['published', 'Published']])
    route.get(`/${path}`, `Actions/${action}` as never)
  server = await route.serve({ hostname: '127.0.0.1', port: 0, nativeRoutes })
  assert(server)
  const base = `http://127.0.0.1:${server.port}`
  for (const [path, marker] of [['ordinary', 'Ordinary'], ['nested', 'Nested/Detail'], ['unregistered', 'NoRegistry'], ['published', 'packaged-default']]) {
    const response = await fetch(`${base}/${path}`)
    assert.equal(response.status, 200, `${mode} ${path} must resolve through native Action loader`)
    const data = await response.json() as { marker: string, origin: string }
    assert.equal(data.marker, marker)
    if (path !== 'published') assert(data.origin.endsWith(`.${mode === 'source' ? 'ts' : 'js'}`))
    const within = relative(await realpath(root), fileURLToPath(data.origin))
    assert(within && within !== '..' && !within.startsWith(`..${sep}`) && !isAbsolute(within), 'handler must come from the current owned project/artifact')
  }
  for (const path of ['broken', 'missing', 'outside', 'prefix', 'symlink', 'directory']) {
    assert.equal((await fetch(`${base}/${path}`)).status, 500, 'existing source/import failure, unowned target or nonregular candidate must not execute sibling JS')
    assert.equal(Reflect.get(globalThis, '__emittedFallbackWasInvoked'), undefined)
  }
  assert.equal(await readFile(join(root, 'storage/framework/auto-imports/actions.ts'), 'utf8'), registry)
  console.log(`native Action registry ${mode} passed`)
}
finally {
  await server?.stop(true)
  process.chdir(original)
  await rm(directory, { recursive: true, force: true })
}
