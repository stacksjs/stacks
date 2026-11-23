import { afterAll, expect, test } from 'bun:test'
import { installBasicAuth } from '@stacksjs/testing/browser'
import { browserStory } from '../src/story-drivers'
import { mkdtemp, mkdir, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const roots: string[] = []
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }) })
const cli = resolve(import.meta.dir, '../../buddy/src/cli.ts')
async function run(args: string[]) {
  const child = Bun.spawn([process.execPath, '--conditions=development', cli, 'docs:stories', ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { code, stdout, stderr }
}

const ffmpeg = Bun.which('ffmpeg')
const encoders: Array<[string, string | undefined]> = [['WebCodecs', undefined]]
if (ffmpeg) encoders.push(['FFmpeg', ffmpeg])

test.each(encoders)('Buddy uses %s to record a browser journey, publish each scene, and detect changed evidence', async (_name, executable) => {
  const root = await mkdtemp(join(tmpdir(), 'story-browser-')); roots.push(root)
  const server = Bun.serve({ port: 0, fetch(request) { return new Response('<html><head><title>Story fixture</title></head><body><main><h1>Cart</h1><button onclick="document.querySelector(\'h1\').textContent=\'Purchased\'">Buy</button><input type="password" value="private-fixture"></main></body></html>', { status: new URL(request.url).pathname === '/unavailable' ? 503 : 200, headers: { 'Content-Type': 'text/html' } }) } })
  try {
    const config = join(root, 'stories.ts')
    const driver = pathToFileURL(resolve(import.meta.dir, '../src/story-drivers.ts')).href
    await Bun.write(config, `import { browserStory } from ${JSON.stringify(driver)}
      export default { outDir: ${JSON.stringify(join(root, 'docs'))}, holdMs: 300, stories: [{ id:'purchase', title:'Purchase', driver:browserStory({baseUrl:${JSON.stringify(server.url.href)},viewport:{width:640,height:480},ffmpeg:${JSON.stringify(executable)}}), scenes:[
        {id:'cart',title:'Review cart',run:async view=>{await view.expectText('h1','Cart')}},
        {id:'purchased',title:'Order confirmed',run:async view=>{await view.click('button');await view.expectText('h1','Purchased')}}
      ] }] }`)
    const result = await run(['--config', config, '--json'])
    if (result.code) console.error(result.stderr, result.stdout)
    expect(result.code).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.results[0].scenes.map((scene: { status: string }) => scene.status)).toEqual(['passed', 'passed'])
    const page = await Bun.file(join(root, 'docs', report.results[0].page.path)).text()
    expect(page).toContain('<video controls')
    expect(page.match(/!\[/g)?.length).toBe(2)
    expect(page).not.toContain('private-fixture')
    const video = join(root, 'docs', report.results[0].video.path)
    // Both encoders produce an H.264 MP4 with the captured viewport.
    const bytes = new Uint8Array(await Bun.file(video).arrayBuffer())
    expect(Buffer.from(bytes.subarray(4, 8)).toString()).toBe('ftyp')
    if (executable) expect(Buffer.from(bytes).includes('Lavf')).toBe(true)
    const { Mp4Demuxer } = await import('@ts-videos/mp4')
    const { BufferSource } = await import('ts-videos')
    const demuxer = new Mp4Demuxer(new BufferSource(bytes))
    const tracks = await demuxer.getTracks()
    const picture = tracks.find(track => track.type === 'video') as { codec: string, width: number, height: number } | undefined
    expect(picture?.codec).toBe('h264')
    expect(picture!.width).toBeGreaterThan(300)
    expect(picture!.height).toBeGreaterThan(200)
    expect((await run(['--config', config, '--check', '--json'])).code).toBe(0)
    expect(await Bun.file(join(report.mediaDir, report.results[0].video.path)).exists()).toBe(true)
    for (const scene of report.results[0].scenes) expect(await Bun.file(join(report.mediaDir, scene.screenshot.path)).exists()).toBe(true)
    const source = await Bun.file(config).text()
    await Bun.write(join(root, 'docs', report.results[0].scenes[1].screenshot.path), 'changed')
    expect((await run(['--config', config, '--check', '--json'])).code).toBe(1)
    await Bun.write(config, source.replace("await view.click('button');await view.expectText('h1','Purchased')", "await view.goto('/unavailable')"))
    const unavailable = await run(['--config', config, '--json'])
    expect(unavailable.code).toBe(1)
    expect(JSON.parse(unavailable.stdout).results[0].scenes[1].status).toBe('failed')
    await Bun.write(config, source.replace("await view.click('button');await view.expectText('h1','Purchased')", "throw new Error('private-fixture')").replace('] }] }', ",{id:'never',title:'Not reached',run(){throw new Error('must not run')}}] }] }"))
    const failed = await run(['--config', config, '--json'])
    expect(failed.code).toBe(1)
    expect(failed.stdout).not.toContain('private-fixture')
    expect(failed.stderr).not.toContain('private-fixture')
    const failedReport = JSON.parse(failed.stdout)
    expect(failedReport.results[0].status).toBe('failed')
    expect(failedReport.results[0].scenes[1].status).toBe('failed')
    expect(failedReport.results[0].scenes[1].screenshot).toBeDefined()
    expect(failedReport.results[0].scenes[2].status).toBe('not-run')
    expect((await run(['--config', config, '--check', '--json'])).code).toBe(1)
    await Bun.write(config, source.replace('holdMs: 300', 'holdMs: 0, timeoutMs: 300').replace("await view.expectText('h1','Cart')", 'await new Promise(()=>{})'))
    const timedOut = await run(['--config', config, '--json'])
    expect(timedOut.code).toBe(1)
    expect(JSON.parse(timedOut.stdout).results[0].status).toBe('failed')
  }
  finally { server.stop(true) }
}, 120000)

test('a gated story authenticates and keeps field masks under a strict style policy', async () => {
  const root = await mkdtemp(join(tmpdir(), 'story-basic-auth-'))
  roots.push(root)
  const authorization = 'Basic ' + btoa('reader:story-fixture')
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      if (request.headers.get('Authorization') !== authorization)
        return new Response(null, { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Story"' } })
      if (new URL(request.url).pathname === '/favicon.ico')
        return new Response(null, { status: 204 })
      return new Response('<!doctype html><main><h1>Private preview</h1><input type="password" value="fixture"><input type="email" value="demo@example.test"><mark>Private note</mark></main>', {
        headers: { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'self'; style-src 'self'" },
      })
    },
  })
  try {
    const driver = browserStory({
      baseUrl: server.url.href,
      masks: ['input[type="email"]', 'mark'],
      async beforeNavigate(cdp) {
        await installBasicAuth(cdp, server.url.origin, 'reader', 'story-fixture')
      },
      async prepare({ cdp }) {
        expect(await cdp.evaluate('location.origin')).toBe(server.url.origin)
        const fields = await cdp.evaluate(`Array.from(document.querySelectorAll('input'), input => {
          const style = getComputedStyle(input)
          return { opacity: style.opacity, fill: style.webkitTextFillColor, border: parseFloat(style.borderTopWidth) > 0 }
        })`)
        expect(fields).toEqual(Array(2).fill({ opacity: '1', fill: 'rgba(0, 0, 0, 0)', border: true }))
        expect(await cdp.evaluate("getComputedStyle(document.querySelector('mark')).opacity")).toBe('0')
        await cdp.evaluate("localStorage.setItem('prepared', 'yes')")
      },
    })
    const recording = await driver.open({ videoPath: join(root, 'preview.mp4'), fps: 10, signal: AbortSignal.timeout(30_000) })
    try {
      await recording.context.expectText('h1', 'Private preview')
      expect(await recording.context.cdp.evaluate("localStorage.getItem('prepared')")).toBe('yes')
      await recording.finish()
      expect(await Bun.file(join(root, 'preview.mp4')).size).toBeGreaterThan(100)
    }
    finally { await recording.close() }
  }
  finally { server.stop(true) }
}, 45_000)

test('Buddy lists browser and native scenes without starting devices or executing story code', async () => {
  const root = await mkdtemp(join(tmpdir(), 'story-cli-')); roots.push(root)
  const config = join(root, 'stories.ts')
  await Bun.write(config, `export default { stories: [
    { id: 'checkout', title: 'Checkout', driver: { platform: 'browser', open() { throw new Error('must not open') } }, scenes: [{ id: 'cart', title: 'Review cart', run() { throw new Error('must not run') } }] },
    { id: 'native', title: 'Native checkout', driver: { platform: 'ios', open() { throw new Error('must not open') } }, scenes: [{ id: 'done', title: 'Purchase confirmed', run() {} }] }
  ] }`)
  const result = await run(['--config', config, '--list', '--json'])
  expect(result.code).toBe(0)
  const report = JSON.parse(result.stdout)
  expect(report.inventory.map((story: { id: string }) => story.id)).toEqual(['checkout', 'native'])
  expect(report.inventory[1].platform).toBe('ios')
  expect(report.inventory[0].scenes[0].id).toBe('cart')
  expect((await run(['--config', config, '--only', 'missing', '--list'])).code).toBe(1)
  const out = join(root, 'handwritten')
  await mkdir(out)
  await Bun.write(join(out, 'index.md'), '# My documentation\n')
  expect((await run(['--config', config, '--out', out])).code).toBe(1)
  expect(await Bun.file(join(out, 'index.md')).text()).toBe('# My documentation\n')
  const linked = join(root, 'linked')
  await symlink(out, linked)
  expect((await run(['--config', config, '--out', linked])).code).toBe(1)
})
