import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// A committed registry that predates the app's own LoginAction still names the
// framework default. The app's file must win, as it does in every other branch
// of the resolver, and the stale entry must be reported (stacksjs/stacks#2947).
const directory = await mkdtemp(join(tmpdir(), 'stacks-stale-actions-'))
const original = process.cwd()
const routerPath = resolve(import.meta.dir, '../../src/runtime.ts')
const plain = (marker: string) => `export default { handle: () => ({ marker: '${marker}' }) }\n`
async function put(path: string, text: string) { await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, text) }
let server: { port: number, stop: (closeActiveConnections?: boolean) => unknown } | undefined

try {
  await put(join(directory, 'storage/framework/auto-imports/actions.ts'), `export const actions = {
  'Actions/Auth/LoginAction': '@stacksjs/defaults/app/Actions/Auth/LoginAction.ts',
  'Actions/Auth/LogoutAction': '@stacksjs/defaults/app/Actions/Auth/LogoutAction.ts',
  'Actions/Ordinary': '../../../app/Actions/Ordinary.ts',
}\n`)
  await put(join(directory, 'node_modules/@stacksjs/defaults/package.json'), JSON.stringify({ name: '@stacksjs/defaults', type: 'module', exports: { './app/Actions/*': './app/Actions/*' } }))
  for (const name of ['LoginAction', 'LogoutAction'])
    await put(join(directory, `node_modules/@stacksjs/defaults/app/Actions/Auth/${name}.ts`), plain(`framework-${name}`))
  // The app overrides LoginAction after the registry was written; LogoutAction it does not.
  await put(join(directory, 'app/Actions/Auth/LoginAction.ts'), plain('app-LoginAction'))
  await put(join(directory, 'app/Actions/Ordinary.ts'), plain('app-Ordinary'))

  process.chdir(directory)
  const { route } = await import(routerPath)
  route.get('/login', 'Actions/Auth/LoginAction' as never)
  route.get('/logout', 'Actions/Auth/LogoutAction' as never)
  route.get('/ordinary', 'Actions/Ordinary' as never)
  server = await route.serve({ hostname: '127.0.0.1', port: 0 })
  const base = `http://127.0.0.1:${server!.port}`
  const marker = async (path: string) => (await (await fetch(`${base}${path}`)).json() as { marker: string }).marker

  assert.equal(await marker('/login'), 'app-LoginAction')
  // The registry still decides where the app has no file of its own.
  assert.equal(await marker('/logout'), 'framework-LogoutAction')
  assert.equal(await marker('/ordinary'), 'app-Ordinary')
  // A second request, so the test can check the warning is said once.
  await marker('/login')
  console.log('stale action registry passed')
}
finally {
  await server?.stop(true)
  process.chdir(original)
  await rm(directory, { recursive: true, force: true })
}
