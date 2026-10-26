import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'

// Exercises the actual CLI and native Chromium metrics. No CDP or DOM API is
// replaced; the page sizes a real canvas from its observed device-pixel ratio.
const root = resolve(import.meta.dir, '../..'), driver = resolve(root, 'storage/framework/defaults/ai/skills/stacks-browse/scripts/browse.ts')
const folder = await mkdtemp(resolve(tmpdir(), 'stacks-device-scale-'))
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch() {
  return new Response('<!doctype html><canvas style="width:200px;height:100px"></canvas><script>const c=document.querySelector("canvas");c.width=200*devicePixelRatio;c.height=100*devicePixelRatio;c.getContext("2d").fillRect(0,0,c.width,c.height);</script>', { headers: { 'Content-Type': 'text/html' } })
} })
try {
  const results = []
  for (const requested of [undefined, '2', '1.5']) {
    const scale = requested === undefined ? 1 : Number(requested), capture = resolve(folder, `scale-${scale}.png`)
    const expression = `({scale:devicePixelRatio,width:document.querySelector('canvas').width,height:document.querySelector('canvas').height,media:matchMedia('(resolution:${scale}dppx)').matches})`
    const args = [process.execPath, driver, 'scenario', server.url.href, '--viewport', '640x480', '--out', capture, '--step', JSON.stringify({ action: 'evaluate', expression })]
    if (requested !== undefined) args.push('--scale', requested)
    // The skill is standalone. Run its actual source outside project boot
    // preloads, as an installed consumer can, without copying its implementation.
    const child = Bun.spawn(args, { cwd: folder, stdout: 'pipe', stderr: 'pipe' })
    const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    if (code !== 0) throw new Error(`Device-scale CLI failed: ${err}`)
    const report = JSON.parse(out), value = report.steps[0]?.value
    if (report.scale !== scale || value?.scale !== scale || value.width !== 200 * scale || value.height !== 100 * scale || value.media !== true) throw new Error(`Requested scale ${scale} differs from actual native metrics: ${JSON.stringify(value)}`)
    if (['consoleErrors', 'failedRequests', 'collectionErrors'].some(key => report[key].length !== 0)) throw new Error('Device-scale browser observations contain errors')
    const png = Buffer.from(await Bun.file(capture).arrayBuffer())
    if (png.readUInt32BE(16) !== 640 * scale || png.readUInt32BE(20) !== 480 * scale) throw new Error('Captured device-pixel dimensions differ from the requested scale')
    results.push({ requested: scale, observed: value, screenshot: { width: png.readUInt32BE(16), height: png.readUInt32BE(20) } })
  }
  console.log(JSON.stringify({ ok: true, results, scope: 'Actual browse scenario CLI, native browser device metrics, canvas backing dimensions, resolution queries and screenshot pixels.' }, null, 2))
}
finally { server.stop(true); await rm(folder, { recursive: true, force: true }) }
