import { afterAll, describe, expect, test } from 'bun:test'
import { lstat, mkdtemp, mkdir, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { captureWorkerTempTemplate } from '../src/capture-browser'
import { captureScreenshots, publishScreenshots, type ScreenshotConfig, validateScreenshotConfig } from '../src/screenshots'

const roots: string[] = []
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }) })
async function fixture() { const root = await mkdtemp(join(tmpdir(), 'screen-capture-test-')); roots.push(root); return root }
const config = (): ScreenshotConfig => ({ baseUrl: 'https://example.test', outDir: 'pictures', pages: [{ id: 'home', title: 'Home', path: '/', description: 'Find today\'s work.', waitFor: 'main' }] })

describe('documentation screenshot inventory', () => {
  test('counts the worker directory when reserving space for the Chrome socket', () => {
    const root = '/tmp/reviewos-job-12345-abcdef/.reviewos-runner/temp'
    expect(captureWorkerTempTemplate(root, 'linux')).toBe('/tmp/stx-b-')
    expect(captureWorkerTempTemplate(root, 'win32')).toBe(join(root, 'stx-b-'))
    expect(captureWorkerTempTemplate('/tmp/reviewos', 'linux')).toBe(join('/tmp/reviewos', 'stx-b-'))
  })

  test('fails on unknown roles, duplicate ids, unsafe paths and cross-origin screens', async () => {
    for (const modify of [
      (value: ScreenshotConfig) => { value.pages.push({ ...value.pages[0]! }) },
      (value: ScreenshotConfig) => { value.pages[0]!.profiles = ['admin'] },
      (value: ScreenshotConfig) => { value.pages[0]!.viewports = ['watch'] },
      (value: ScreenshotConfig) => { value.pages[0]!.viewports = [] },
      (value: ScreenshotConfig) => { value.pages[0]!.id = '../secret' },
      (value: ScreenshotConfig) => { value.pages[0]!.path = 'https://other.test/' },
      (value: ScreenshotConfig) => { value.baseUrl = 'https://user:secret@example.test' },
      (value: ScreenshotConfig) => { value.pages[0]!.expectedStatus = 600 },
      (value: ScreenshotConfig) => { value.pages[0]!.expectedStatus = 200.5 },
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
      ${process.env.STACKS_BROWSER_TESTS ? "backend: 'chrome'," : ''}
      profiles: { runner: {prepare: async ({view,baseUrl}) => {await view.navigate(baseUrl+'/set')}}, visitor: {} },
      viewports: [{name:'mobile',width:390,height:844}],
      pages: [{id:'home',title:'Home',path:'/',description:'The role-specific home.',waitFor:'main[data-ready="yes"]',
        ready: async ({view,profile}) => { const text=await view.evaluate('document.querySelector("#role").textContent'); if(profile==='visitor' && text!=='anonymous') throw new Error('role leaked'); return true }
      }, {id:'project',title:'Project detail',path:'/projects/[id]',model:'Project',description:'Inspect a synthetic seeded project.',waitFor:'main'}, {id:'resolved',title:'Resolved project',route:'/projects/[id]',path:async ({fixtures})=>'/projects/'+fixtures.Project.id,description:'A legacy API supplies the concrete fixture.',waitFor:'main'}]
    }`)
    const report = await captureScreenshots({ root, config: 'screens.ts' })
    expect(report.results.map(result => result.status)).toEqual(['captured', 'captured', 'captured', 'captured', 'captured', 'captured'])
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
        {id:'waiting',title:'Waiting',path:'/',description:'Data must arrive.',waitFor:'[data-never-ready]'},
        {id:'escape',title:'Invalid target',route:'/future',path:async ()=>'https://elsewhere.test/',description:'A resolver cannot leave this origin.',waitFor:'main'}
      ]
    }`)
    const report = await captureScreenshots({ root, config: 'screens.ts' })
    expect(report.results.map(result => result.status)).toEqual(['failed', 'failed', 'failed'])
    expect(report.results[0]!.error).toContain('redirected')
    expect(report.results[2]!.error).toContain('configured origin')
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


test.skipIf(typeof Bun.WebView !== 'function' || (process.platform !== 'darwin' && !process.env.STACKS_BROWSER_TESTS))('refuses HTTP error pages and captures explicitly expected error states', async () => {
  const root = await fixture()
  const outDir = join('pictures', 'nested-capture-directory'.repeat(7))
  const tempRecord = join(root, 'worker-temp.txt')
  const server = Bun.serve({ port: 0, fetch(request) {
    const status = new URL(request.url).pathname === '/missing' ? 404 : 503
    return new Response('<title>Unavailable</title><main>This screen is deliberately unavailable.</main>', { status, headers: { 'Content-Type': 'text/html' } })
  } })
  try {
    await Bun.write(join(root, 'screens.ts'), `export default {
      baseUrl:'http://127.0.0.1:${server.port}', outDir:${JSON.stringify(outDir)}, backend:'chrome', requireHttpStatus:true,
      viewports:[{name:'mobile',width:390,height:844}], pages:[
        {id:'missing',title:'Missing route',path:'/missing',description:'A broken route is not a successful screen.',waitFor:'main'},
        {id:'expected',title:'Reviewed missing state',path:'/missing',expectedStatus:404,description:'An intentional missing-state example.',waitFor:'main',ready:async ({httpStatus})=>{
          const { tmpdir } = await import('node:os')
          const { readdir } = await import('node:fs/promises')
          const temporary = tmpdir()
          const ownsProfile = (await readdir(temporary)).some(name => name.startsWith('stacks-browser-'))
          if (!ownsProfile) return false
          await Bun.write(${JSON.stringify(tempRecord)}, temporary)
          return httpStatus === 404
        }},
        {id:'wrong',title:'Wrong status',path:'/missing',expectedStatus:200,description:'An expected success must be an HTTP success.',waitFor:'main'},
        {id:'unavailable',title:'Unavailable service',path:'/unavailable',description:'An unavailable service must fail the capture.',waitFor:'main'}
      ]
    }`)
    const report = await captureScreenshots({ root, config: 'screens.ts' })
    expect(report.results.map(result => result.status)).toEqual(['failed', 'captured', 'failed', 'failed'])
    expect(report.results.map(result => result.httpStatus)).toEqual([404, 404, 404, 503])
    expect(report.results[0]!.error).toContain('HTTP 404')
    expect(report.results[2]!.error).toContain('instead of 200')
    expect(report.results[3]!.error).toContain('HTTP 503')
    expect(await Bun.file(join(root, outDir, report.results[1]!.file!)).exists()).toBe(true)
    expect((await readdir(join(root, outDir))).filter(name => name.startsWith('.stacks-screenshots-'))).toEqual([])
    const workerTemp = await Bun.file(tempRecord).text()
    expect(workerTemp).toMatch(/[/\\]stx-b-[^/\\]+$/)
    await expect(lstat(workerTemp)).rejects.toMatchObject({ code: 'ENOENT' })
    const manifest = { ...report, generatorVersion: 'previous-sdk' }
    await Bun.write(join(root, 'pictures/manifest.json'), JSON.stringify(manifest))
    await expect(captureScreenshots({ root, config: 'screens.ts', check: true })).rejects.toThrow('capture again')
  }
  finally { server.stop(true) }
}, 60_000)

test('refuses a partial refresh with changed inputs before losing old image ownership', async () => {
  const root = await fixture()
  await Bun.write(join(root, 'screens.ts'), `export default {baseUrl:'https://example.test',outDir:'pictures',pages:[{id:'home',title:'Home',path:'/',description:'Home.',waitFor:'main'}]}`)
  await mkdir(join(root, 'pictures/home'), { recursive: true })
  await Bun.write(join(root, 'pictures/home/default-mobile.png'), 'owned image')
  const original = { generator: '@stacksjs/docs/screenshots', configHash: 'old-inputs', results: [{ file: 'home/default-mobile.png' }] }
  await Bun.write(join(root, 'pictures/manifest.json'), JSON.stringify(original))
  await expect(captureScreenshots({ root, config: 'screens.ts', only: ['home'] })).rejects.toThrow('fresh output directory')
  expect(await Bun.file(join(root, 'pictures/manifest.json')).json()).toEqual(original)
  expect(await Bun.file(join(root, 'pictures/home/default-mobile.png')).text()).toBe('owned image')
})


test.skipIf(typeof Bun.WebView !== 'function' || (process.platform !== 'darwin' && !process.env.STACKS_BROWSER_TESTS))('a failed refresh retains owned image bytes and permits recovery', async () => {
  const root = await fixture()
  let status = 200
  const server = Bun.serve({ port: 0, fetch: () => new Response('<title>Account</title><main>A fully loaded account screen.</main>', { status, headers: { 'Content-Type': 'text/html' } }) })
  try {
    await Bun.write(join(root, 'screens.ts'), `export default {baseUrl:'http://127.0.0.1:${server.port}',outDir:'pictures',backend:'chrome',requireHttpStatus:true,viewports:[{name:'mobile',width:390,height:844}],pages:[{id:'account',title:'Account',path:'/',description:'An owned account.',waitFor:'main'}]}`)
    const initial = await captureScreenshots({ root, config: 'screens.ts' })
    const image = join(root, 'pictures', initial.results[0]!.file!)
    const bytes = await Bun.file(image).bytes()
    status = 503
    const failed = await captureScreenshots({ root, config: 'screens.ts', only: ['account'] })
    expect(failed.results[0]!.status).toBe('failed')
    expect(failed.results[0]!.file).toBe(initial.results[0]!.file)
    expect(failed.results[0]!.sha256).toBe(initial.results[0]!.sha256)
    expect(await Bun.file(image).bytes()).toEqual(bytes)
    await expect(captureScreenshots({ root, config: 'screens.ts', check: true })).rejects.toThrow('failed')
    status = 200
    expect((await captureScreenshots({ root, config: 'screens.ts', only: ['account'] })).results[0]!.status).toBe('captured')
    await captureScreenshots({ root, config: 'screens.ts', check: true })
  }
  finally { server.stop(true) }
}, 60_000)

test.skipIf(typeof Bun.WebView !== 'function' || (process.platform !== 'darwin' && !process.env.STACKS_BROWSER_TESTS))('a screen that stalls past its deadline is tried again; other failures are final', async () => {
  const root = await fixture()
  let requests = 0
  // The first request stalls past the deadline, as a busy app server can.
  const server = Bun.serve({ port: 0, async fetch(request) {
    if (new URL(request.url).pathname === '/missing') return new Response('<title>Missing</title><main>Gone</main>', { status: 404, headers: { 'Content-Type': 'text/html' } })
    if (new URL(request.url).pathname !== '/') return new Response('', { status: 204 })
    if (++requests === 1) await Bun.sleep(4000)
    return new Response('<title>Account</title><main>A fully loaded account screen.</main>', { headers: { 'Content-Type': 'text/html' } })
  } })
  const screens = (retries: number) => `export default {baseUrl:'http://127.0.0.1:${server.port}',outDir:'pictures',backend:'chrome',requireHttpStatus:true,timeoutMs:2000,retries:${retries},viewports:[{name:'mobile',width:390,height:844}],pages:[{id:'account',title:'Account',path:'/',description:'Account.',waitFor:'main'},{id:'missing',title:'Missing',path:'/missing',description:'Missing.',waitFor:'main'}]}`
  try {
    await Bun.write(join(root, 'screens.ts'), screens(1))
    const retried = await captureScreenshots({ root, config: 'screens.ts' })
    expect(retried.results.map(result => [result.id, result.status])).toEqual([['account', 'captured'], ['missing', 'failed']])
    expect(requests).toBe(2)
    // A 404 is the screen's own failure: one attempt, recorded as such.
    expect(retried.results[1]!.attempts).toBe(1)
    expect(retried.results[1]!.error).toContain('HTTP 404')

    requests = 0
    await Bun.write(join(root, 'once.ts'), screens(0))
    const once = await captureScreenshots({ root, config: 'once.ts', only: ['account'], outDir: 'once' })
    expect(once.results[0]!.status).toBe('failed')
    expect(once.results[0]!.error).toContain('deadline exceeded')
    expect(once.results[0]!.attempts).toBe(1)
  }
  finally { server.stop(true) }
}, 90_000)

describe('screens discovered from stx views', () => {
  test('lists every view with a stable id, route and source, and explains dynamic gaps', async () => {
    const root = await fixture()
    await mkdir(join(root, 'resources/views/projects'), { recursive: true })
    await Bun.write(join(root, 'resources/views/index.stx'), '<title>Welcome home</title><main>Home</main>')
    await Bun.write(join(root, 'resources/views/settings.stx'), '@extends(\'layouts/app\')\n<main>Settings</main>')
    await Bun.write(join(root, 'resources/views/projects/index.stx'), '<main>Projects</main>')
    await Bun.write(join(root, 'resources/views/projects/[id].stx'), '<main>Project</main>')
    const { discoverViews, screensFromViews } = await import('../src/screenshot-views')
    expect(discoverViews({ root }).map(view => [view.id, view.route, view.source, view.group, view.dynamic])).toEqual([
      ['index', '/', 'resources/views/index.stx', 'home', false],
      ['projects', '/projects', 'resources/views/projects/index.stx', 'projects', false],
      ['projects-id', '/projects/[id]', 'resources/views/projects/[id].stx', 'projects', true],
      ['settings', '/settings', 'resources/views/settings.stx', 'settings', false],
    ])
    const pages = screensFromViews({ root, defaults: { waitFor: 'main' }, each: view => view.layout === 'layouts/app' ? { profiles: ['member'] } : undefined })
    expect(pages.map(page => page.title)).toEqual(['Welcome home', 'Projects', 'Projects / by id', 'Settings'])
    expect(pages.find(page => page.id === 'projects-id')!.skip).toContain('/projects/[id]')
    expect(pages.find(page => page.id === 'settings')!.profiles).toEqual(['member'])
    // The derived inventory satisfies template coverage without a hand-written list.
    await validateScreenshotConfig({ baseUrl: 'https://example.test', outDir: 'pictures', profiles: { member: {} }, coverage: { directories: ['resources/views'] }, pages }, root)

    const bound = screensFromViews({ root, routes: { '/projects/[id]': { path: ({ fixtures }) => `/projects/${fixtures.Project!.id}` }, '/settings': 'Shown in the account guide instead.' } })
    expect(bound.find(page => page.id === 'projects-id')).toMatchObject({ route: '/projects/[id]' })
    expect(bound.find(page => page.id === 'projects-id')!.skip).toBeUndefined()
    expect(bound.find(page => page.id === 'settings')!.skip).toBe('Shown in the account guide instead.')
    expect(() => screensFromViews({ root, strict: true })).toThrow('/projects/[id]')
    expect(() => screensFromViews({ root, routes: { '/gone': { waitFor: 'main' } } })).toThrow('/gone')
  })
})

test.skipIf(typeof Bun.WebView !== 'function' || (process.platform !== 'darwin' && !process.env.STACKS_BROWSER_TESTS))('films the discovered screens, writes their documentation page and retires deleted views', async () => {
  const root = await fixture()
  const server = Bun.serve({ port: 0, fetch: request => new Response(`<title>Fixture</title><main><h1>${new URL(request.url).pathname}</h1></main>`, { headers: { 'Content-Type': 'text/html' } }) })
  try {
    await mkdir(join(root, 'resources/views'), { recursive: true })
    await Bun.write(join(root, 'resources/views/index.stx'), '<main>Home</main>')
    await Bun.write(join(root, 'resources/views/pricing.stx'), '<main>Pricing</main>')
    await Bun.write(join(root, 'resources/views/[slug].stx'), '<main>Profile</main>')
    await Bun.write(join(root, 'screens.ts'), `import { screensFromViews } from ${JSON.stringify(join(import.meta.dir, '../src/screenshot-views.ts'))}
      export default { baseUrl: 'http://127.0.0.1:${server.port}', outDir: 'docs/public/screens', timeoutMs: 15000, models: false,
        viewports: [{ name: 'mobile', width: 390, height: 844 }, { name: 'wide', width: 1000, height: 700 }], coverage: { directories: ['resources/views'] },
        film: { secondsPerScreen: 0.5, viewports: ['mobile'] }, docs: { page: 'docs/screens.md', base: '/screens', title: 'Every screen' },
        ${process.env.STACKS_BROWSER_TESTS ? "backend: 'chrome'," : ''}
        pages: screensFromViews({ root: ${JSON.stringify(root)}, defaults: { waitFor: 'main', viewports: ['mobile'] }, routes: { '/': { viewports: ['mobile', 'wide'] } } }) }`)
    const report = await captureScreenshots({ root, config: 'screens.ts' })
    // Only the home page is pictured wide; every other screen is phone-only.
    expect(report.results.map(result => [result.id, result.viewport.name, result.status])).toEqual([['index', 'mobile', 'captured'], ['slug', 'mobile', 'skipped'], ['pricing', 'mobile', 'captured'], ['index', 'wide', 'captured']])
    expect(report.films).toMatchObject([{ viewport: 'mobile', file: 'film-mobile.mp4', screens: 2, seconds: 1 }])
    const film = new Uint8Array(await Bun.file(join(root, 'docs/public/screens/film-mobile.mp4')).arrayBuffer())
    expect(Buffer.from(film.subarray(4, 8)).toString()).toBe('ftyp')
    const page = await Bun.file(join(root, 'docs/screens.md')).text()
    expect(page).toContain('# Every screen')
    expect(page).toContain('src="/screens/film-mobile.mp4"')
    expect(page).toContain('src="/screens/pricing/default-mobile.png"')
    expect(page).toContain('## Not pictured')
    await captureScreenshots({ root, config: 'screens.ts', check: true })

    // A removed view loses its picture and its section on the next full capture.
    // A batch wrapper captures without publishing, then publishes once.
    const quiet = await captureScreenshots({ root, config: 'screens.ts', only: ['index'], publish: false })
    expect(quiet.films).toBeUndefined()
    await expect(captureScreenshots({ root, config: 'screens.ts', check: true })).rejects.toThrow('film is missing')
    const republished = await publishScreenshots({ root, config: 'screens.ts' })
    expect(republished.films).toMatchObject([{ viewport: 'mobile', screens: 2 }])
    await captureScreenshots({ root, config: 'screens.ts', check: true })

    // A partial run into a fresh folder pictures a few screens without
    // replacing the films and page, which describe the whole app.
    const pageBefore = await Bun.file(join(root, 'docs/screens.md')).text()
    const trial = await captureScreenshots({ root, config: 'screens.ts', only: ['pricing'], outDir: 'trial' })
    expect(trial.results.map(result => result.status)).toEqual(['captured'])
    expect(trial.films).toBeUndefined()
    expect(trial.docsPage).toBeUndefined()
    expect(await Bun.file(join(root, 'trial/film-mobile.mp4')).exists()).toBe(false)
    expect(await Bun.file(join(root, 'docs/screens.md')).text()).toBe(pageBefore)
    await expect(publishScreenshots({ root, config: 'screens.ts', outDir: 'trial' })).rejects.toThrow('only part of the inventory')

    // A second file name, because one process caches the imported config module.
    await rm(join(root, 'resources/views/pricing.stx'))
    await Bun.write(join(root, 'next.ts'), await Bun.file(join(root, 'screens.ts')).text())
    const next = await captureScreenshots({ root, config: 'next.ts' })
    expect(next.results.map(result => result.id)).toEqual(['index', 'slug', 'index'])
    expect(await Bun.file(join(root, 'docs/public/screens/pricing/default-mobile.png')).exists()).toBe(false)
    expect(await Bun.file(join(root, 'docs/screens.md')).text()).not.toContain('pricing')
    await captureScreenshots({ root, config: 'next.ts', check: true })

    await Bun.write(join(root, 'docs/screens.md'), '# Hand-written')
    await expect(captureScreenshots({ root, config: 'next.ts' })).rejects.toThrow('hand-written')
  }
  finally { server.stop(true) }
}, 120_000)
