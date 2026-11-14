import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { captureScreenshots, type ScreenshotConfig, validateScreenshotConfig } from '../src/screenshots'

const roots: string[] = []
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }) })
async function fixture() { const root = await mkdtemp(join(tmpdir(), 'screen-capture-test-')); roots.push(root); return root }
const config = (): ScreenshotConfig => ({ baseUrl: 'https://example.test', outDir: 'pictures', pages: [{ id: 'home', title: 'Home', path: '/', description: 'Find today\'s work.', waitFor: 'main' }] })

describe('documentation screenshot inventory', () => {
  test('fails on unknown roles, duplicate ids, unsafe paths and cross-origin screens', async () => {
    for (const modify of [
      (value: ScreenshotConfig) => { value.pages.push({ ...value.pages[0]! }) },
      (value: ScreenshotConfig) => { value.pages[0]!.profiles = ['admin'] },
      (value: ScreenshotConfig) => { value.pages[0]!.id = '../secret' },
      (value: ScreenshotConfig) => { value.pages[0]!.path = 'https://other.test/' },
      (value: ScreenshotConfig) => { value.baseUrl = 'https://user:secret@example.test' },
    ]) {
      const value = config(); modify(value)
      await expect(validateScreenshotConfig(value)).rejects.toBeInstanceOf(Error)
    }
  })

  test('requires every real template to have a documented screen or a reason', async () => {
    const root = await fixture()
    await mkdir(join(root, 'views'))
    await Bun.write(join(root, 'views/index.stx'), '<main>Home</main>')
    await Bun.write(join(root, 'views/reset.stx'), '<main>Reset password</main>')
    const value = config()
    value.coverage = { directories: ['views'] }
    value.pages[0]!.sources = ['views/index.stx']
    await expect(validateScreenshotConfig(value, root)).rejects.toThrow('views/reset.stx')
    value.coverage.exclude = { 'views/reset.stx': 'A one-use emailed token is required; covered by the recovery guide.' }
    await validateScreenshotConfig(value, root)
    value.coverage.exclude['views/deleted.stx'] = 'Old route'
    await expect(validateScreenshotConfig(value, root)).rejects.toThrow('Stale')
  })
})

test.skipIf(typeof Bun.WebView !== 'function' || (process.platform !== 'darwin' && !process.env.STACKS_BROWSER_TESTS))('captures real pages with isolated roles, readiness, PNG hashes and complete inventory checks', async () => {
  const root = await fixture()
  const server = Bun.serve({ port: 0, fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/set') return new Response('<title>Sign in</title><main>Sign in</main>', { headers: { 'Content-Type': 'text/html', 'Set-Cookie': 'role=runner; Path=/' } })
    return new Response(`<title>Fixture</title><main><h1>Screen</h1><input type="password" value="private-value"><div id="role">${request.headers.get('cookie') || 'anonymous'}</div><script>setTimeout(()=>document.querySelector('main').dataset.ready='yes',150)</script></main>`, { headers: { 'Content-Type': 'text/html' } })
  } })
  try {
    await mkdir(join(root, 'app/Models'), { recursive: true })
    await Bun.write(join(root, 'app/Models/Project.ts'), 'export default { name: "Project", traits: {useApi: {uri: "projects"}}, attributes: {} }')
    await Bun.write(join(root, 'screens.ts'), `export default {
      baseUrl: 'http://127.0.0.1:${server.port}', outDir: 'pictures', timeoutMs: 15000, fixtures: {Project: {id: 7}},
      profiles: { runner: {prepare: async ({view,baseUrl}) => {await view.navigate(baseUrl+'/set')}}, visitor: {} },
      viewports: [{name:'mobile',width:390,height:844}],
      pages: [{id:'home',title:'Home',path:'/',description:'The role-specific home.',waitFor:'main[data-ready="yes"]',
        ready: async ({view,profile}) => { const text=await view.evaluate('document.querySelector("#role").textContent'); if(profile==='visitor' && text!=='anonymous') throw new Error('role leaked'); return true }
      }, {id:'project',title:'Project detail',path:'/projects/[id]',model:'Project',description:'Inspect a synthetic seeded project.',waitFor:'main'}]
    }`)
    const report = await captureScreenshots({ root, config: 'screens.ts' })
    expect(report.results.map(result => result.status)).toEqual(['captured', 'captured', 'captured', 'captured'])
    expect(report.results.filter(result => result.id === 'project').map(result => result.path)).toEqual(['/projects/7', '/projects/7'])
    for (const result of report.results) {
      const png = new Uint8Array(await Bun.file(join(root, 'pictures', result.file!)).arrayBuffer())
      expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
      expect(result.sha256).toHaveLength(64)
    }
    await captureScreenshots({ root, config: 'screens.ts', check: true })
    await captureScreenshots({ root, config: 'screens.ts', only: ['home'], viewports: ['mobile'] })
    await captureScreenshots({ root, config: 'screens.ts', check: true })
    await Bun.write(join(root, 'pictures', report.results[0]!.file!), 'bad bytes')
    await expect(captureScreenshots({ root, config: 'screens.ts', check: true })).rejects.toThrow('bytes changed')
  }
  finally { server.stop(true) }
}, 90_000)

test.skipIf(typeof Bun.WebView !== 'function' || (process.platform !== 'darwin' && !process.env.STACKS_BROWSER_TESTS))('records timeout and redirect failures instead of photographing login as a successful screen', async () => {
  const root = await fixture()
  const server = Bun.serve({ port: 0, fetch(request) {
    if (new URL(request.url).pathname === '/private') return Response.redirect('/login', 302)
    return new Response('<title>Login</title><main>Login</main>', { headers: { 'Content-Type': 'text/html' } })
  } })
  try {
    await Bun.write(join(root, 'screens.ts'), `export default {
      baseUrl:'http://127.0.0.1:${server.port}', outDir:'pictures', timeoutMs:5000,
      viewports:[{name:'mobile',width:390,height:844}], pages:[
        {id:'private',title:'Private',path:'/private',description:'Private account screen.',waitFor:'main'},
        {id:'waiting',title:'Waiting',path:'/',description:'Data must arrive.',waitFor:'[data-never-ready]'}
      ]
    }`)
    const report = await captureScreenshots({ root, config: 'screens.ts' })
    expect(report.results.map(result => result.status)).toEqual(['failed', 'failed'])
    expect(report.results[0]!.error).toContain('redirected')
    expect(report.results[1]!.error).toMatch(/deadline|ready/)
    await expect(captureScreenshots({ root, config: 'screens.ts', check: true })).rejects.toThrow('failed')
  }
  finally { server.stop(true) }
}, 30_000)

test('refuses unowned image and manifest collisions before opening a browser', async () => {
  const root = await fixture()
  await Bun.write(join(root, 'screens.ts'), `export default {baseUrl:'https://example.test',outDir:'pictures',viewports:[{name:'mobile',width:390,height:844}],pages:[{id:'home',title:'Home',path:'/',description:'Home screen.',waitFor:'main'}]}`)
  await mkdir(join(root, 'pictures/home'), { recursive: true })
  await Bun.write(join(root, 'pictures/home/default-mobile.png'), 'hand-written asset')
  await expect(captureScreenshots({ root, config: 'screens.ts' })).rejects.toThrow('unowned screenshot')
  expect(await Bun.file(join(root, 'pictures/home/default-mobile.png')).text()).toBe('hand-written asset')
  await Bun.write(join(root, 'pictures/manifest.json'), JSON.stringify({ format: 1 }))
  await expect(captureScreenshots({ root, config: 'screens.ts' })).rejects.toThrow('unowned manifest')
})
