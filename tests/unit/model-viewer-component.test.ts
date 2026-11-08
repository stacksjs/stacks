import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { defaultConfig } from '@stacksjs/stx/config'
import { processDirectives } from '@stacksjs/stx/process'
import { click, findChrome, launch, navigate, settle, waitFor } from '@stacksjs/testing/browser'

test.skipIf(!findChrome())('native ModelViewer renders two isolated scenes, reacts to parent props, supports keyboard and recovers to a drawing on load failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-model-viewer-'))
  let server: ReturnType<typeof Bun.serve> | undefined
  let browser: Awaited<ReturnType<typeof launch>> | undefined
  try {
    const source = `<!doctype html><html><body><script client>
const scene = state({nodes:[{id:'first',geometry:{kind:'box',size:[10,20,30]},color:'#234b38'}]})
const second = state({nodes:[{id:'second',geometry:{kind:'box',size:[20,10,10]}}]})
function add(){scene.set({nodes:[...scene().nodes,{id:'added',geometry:{kind:'box',size:[5,5,5]},color:'#88948e'}]})}
function fail(){second.set({nodes:[{id:'missing',geometry:{kind:'stl',src:'/missing.stl'}}]})}
</script><div id="first"><ModelViewer :scene="scene()" label="First model" /></div><div id="second"><ModelViewer :scene="second()" label="Second model" poster="/poster.svg" /></div><button id="add" @click="add()">Add</button><button id="fail" @click="fail()">Fail</button></body></html>`
    const html = await processDirectives(source, {}, join(root, 'Page.stx'), { ...defaultConfig, root, componentsDir: resolve(import.meta.dir, '../../storage/framework/defaults/resources/components'), cache: false }, new Set())
    server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
      const path = new URL(request.url).pathname
      if (path === '/missing.stl') return new Response('Missing', { status: 404 })
      if (path === '/poster.svg') return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="green"/></svg>', { headers: { 'Content-Type': 'image/svg+xml' } })
      return new Response(html, { headers: { 'Content-Type': 'text/html' } })
    } })
    browser = await launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
    const { cdp } = browser
    await navigate(cdp, `http://127.0.0.1:${server.port}`)
    await waitFor(() => cdp.evaluate("document.querySelectorAll('[data-model-status=ready]').length === 2"))
    await click(cdp, '#add')
    await waitFor(() => cdp.evaluate("document.querySelector('#first canvas').dataset.modelNodes === '2'"))
    expect(await cdp.evaluate("document.querySelector('#second canvas').dataset.modelNodes")).toBe('1')
    await cdp.evaluate("document.querySelector('#first canvas').focus()")
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 })
    await click(cdp, '#first button[aria-label="Reset 3D view"]')
    expect(cdp.errors).toEqual([])
    await click(cdp, '#fail')
    await waitFor(() => cdp.evaluate("document.querySelector('#second [data-model-status]').dataset.modelStatus === 'error'"))
    await settle(cdp)
    expect(await cdp.evaluate("document.querySelector('#second .stx-model-viewer-fallback').textContent")).toContain('could not be loaded')
    expect(await cdp.evaluate("document.querySelector('#first [data-model-status]').dataset.modelStatus")).toBe('ready')
    expect(cdp.errors.filter(error => !error.includes('404 (Not Found)'))).toEqual([])
  }
  finally { await browser?.close(); server?.stop(true); await rm(root, { recursive: true, force: true }) }
}, 45000)

test.skipIf(!findChrome())('native viewer ignores a superseded mesh load and releases real GPU resources while aborting disposal work', async () => {
  let browser: Awaited<ReturnType<typeof launch>> | undefined
  let server: ReturnType<typeof Bun.serve> | undefined
  const build = await Bun.build({ entrypoints: [resolve(import.meta.dir, '../../storage/framework/core/browser/src/model-viewer.ts')], target: 'browser', write: false })
  expect(build.success).toBe(true)
  const script = await build.outputs[0]!.text()
  const stl = new ArrayBuffer(134); const data = new DataView(stl)
  data.setUint32(80, 1, true)
  ;[0, 0, 0, 10, 0, 0, 0, 20, 0].forEach((value, i) => data.setFloat32(96 + i * 4, value, true))
  let requests = 0
  try {
    server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
      const path = new URL(request.url).pathname
      if (path === '/viewer.js') return new Response(script, { headers: { 'Content-Type': 'application/javascript' } })
      if (path.endsWith('.stl')) { requests++; await new Promise(resolve => setTimeout(resolve, 180)); return new Response(stl) }
      return new Response(`<canvas id="first" width="600" height="200" style="width:600px;height:200px"></canvas><canvas id="second" width="600" height="200" style="width:600px;height:200px"></canvas><script type="module">
import {createModelViewer} from '/viewer.js';
const statuses=[]; const canvas=document.querySelector('#first'); const viewer=createModelViewer(canvas,{onStatus:status=>statuses.push(status)});
const scene={nodes:[{id:'box',geometry:{kind:'box',size:[10,20,30]}}]};
window.viewerTest={viewer,scene,statuses,canvas,second:document.querySelector('#second')};
</script>`, { headers: { 'Content-Type': 'text/html' } })
    } })
    browser = await launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
    const { cdp } = browser
    await navigate(cdp, `http://127.0.0.1:${server.port}`)
    await waitFor(() => cdp.evaluate('Boolean(window.viewerTest)'))
    await cdp.evaluate("(() => {const t=window.viewerTest;t.pending=t.viewer.setScene({nodes:[{id:'slow',geometry:{kind:'stl',src:'/slow.stl'}}]});})()")
    await waitFor(async () => requests === 1)
    await cdp.evaluate('window.viewerTest.viewer.setScene(window.viewerTest.scene)')
    await cdp.evaluate('window.viewerTest.pending')
    expect(await cdp.evaluate('window.viewerTest.statuses.at(-1)')).toBe('ready')
    expect(await cdp.evaluate('window.viewerTest.canvas.dataset.modelVertices')).toBe('36')
    await cdp.evaluate("window.viewerTest.canvas.getContext('webgl').getExtension('WEBGL_lose_context').loseContext()")
    await waitFor(() => cdp.evaluate("window.viewerTest.statuses.at(-1)==='error'"))
    await cdp.evaluate("(async()=>{const t=window.viewerTest;const {createModelViewer}=await import('/viewer.js');t.disposable=createModelViewer(t.second);await t.disposable.setScene(t.scene);const gl=t.second.getContext('webgl');t.gl=gl;t.buffer=gl.getParameter(gl.ARRAY_BUFFER_BINDING);t.pending=t.disposable.setScene({nodes:[{id:'aborted',geometry:{kind:'stl',src:'/another.stl'}}]});})()")
    await waitFor(async () => requests === 2)
    await cdp.evaluate('window.viewerTest.disposable.dispose();window.viewerTest.viewer.dispose()')
    await cdp.evaluate('window.viewerTest.pending')
    expect(await cdp.evaluate('window.viewerTest.gl.isBuffer(window.viewerTest.buffer)')).toBe(false)
    await cdp.evaluate('window.viewerTest.disposable.setScene(window.viewerTest.scene)')
    expect(requests).toBe(2)
    expect(cdp.errors).toEqual([])
  }
  finally { await browser?.close(); server?.stop(true) }
}, 45000)
