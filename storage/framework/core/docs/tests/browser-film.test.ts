import { afterAll, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Mp4Demuxer } from '@ts-videos/mp4'
import { BufferSource } from 'ts-videos'
import { openBrowserFilm, serveFilmStudio } from '../src/browser-film'

const roots: string[] = []
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }) })
const browser = (): Bun.WebView => new Bun.WebView({ width: 320, height: 240, backend: process.platform === 'darwin' && process.env.STACKS_FILM_BACKEND !== 'chrome' ? 'webkit' : { type: 'chrome', url: false, argv: process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : [] } })
const describeVideo = async (bytes: Uint8Array) => (await new Mp4Demuxer(new BufferSource(bytes)).getTracks()).find(track => track.type === 'video') as { codec: string, width: number, height: number }

test.skipIf(typeof Bun.WebView !== 'function' || (process.platform !== 'darwin' && !process.env.STACKS_BROWSER_TESTS))('encodes pictures and re-times a recording with tap marks, without FFmpeg', async () => {
  const root = await mkdtemp(join(tmpdir(), 'browser-film-test-'))
  roots.push(root)
  const raw = join(root, 'raw.mp4')
  const marked = join(root, 'marked.mp4')

  // A two-second "device recording": one second red, one second blue.
  let room = serveFilmStudio()
  let view = browser()
  try {
    await view.navigate(room.url)
    const solid = async (color: string): Promise<Uint8Array> => new Uint8Array(Buffer.from(String(await view.evaluate(`(() => { const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 200; const context = canvas.getContext('2d'); context.fillStyle = ${JSON.stringify(color)}; context.fillRect(0, 0, 320, 200); return canvas.toDataURL('image/png').split(',')[1] })()`)), 'base64'))
    const film = await openBrowserFilm(script => view.evaluate(script), { fps: 10 })
    await film.add(await solid('#ff0000'), 10)
    await film.add(await solid('#0000ff'), 10)
    expect(film.frames()).toBe(20)
    await Bun.write(raw, await film.finish())
  }
  finally { view.close(); room.stop() }
  expect(await describeVideo(new Uint8Array(await Bun.file(raw).arrayBuffer()))).toMatchObject({ codec: 'h264', width: 320, height: 200 })

  // Re-timed to five frames a second, with a green tap mark during the first 0.9 s.
  room = serveFilmStudio({ '/raw.mp4': raw })
  view = browser()
  try {
    await view.navigate(room.url)
    const film = await openBrowserFilm(script => view.evaluate(script), { fps: 5 })
    const seconds = await film.addVideo('/raw.mp4', [{ x: 100, y: 100, size: 40, color: '#00ff00', start: 0, end: 0.9 }])
    expect(seconds).toBeGreaterThan(1.8)
    expect(seconds).toBeLessThan(2.2)
    expect(film.frames()).toBe(10)
    await Bun.write(marked, await film.finish())
  }
  finally { view.close(); room.stop() }
  expect(await describeVideo(new Uint8Array(await Bun.file(marked).arrayBuffer()))).toMatchObject({ codec: 'h264', width: 320, height: 200 })

  // Read the result back in a browser: the mark's edge is green while the tap
  // is active and gone afterwards, over the recording's own red, then blue.
  room = serveFilmStudio({ '/marked.mp4': marked })
  view = browser()
  try {
    await view.navigate(room.url)
    const pixels = JSON.parse(String(await view.evaluate(`(async () => {
      const video = document.createElement('video'); video.muted = true; video.preload = 'auto'
      await new Promise((resolve, reject) => { video.addEventListener('loadeddata', resolve, { once: true }); video.addEventListener('error', () => reject(new Error('unplayable')), { once: true }); video.src = '/marked.mp4' })
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      const at = async (time, x, y) => { await new Promise((resolve) => { video.addEventListener('seeked', resolve, { once: true }); video.currentTime = time }); context.drawImage(video, 0, 0); return [...context.getImageData(x, y, 1, 1).data.slice(0, 3)] }
      return JSON.stringify({ edgeDuring: await at(0.45, 100, 82), centreDuring: await at(0.45, 100, 100), edgeAfter: await at(1.45, 100, 82), centreAfter: await at(1.45, 100, 100) })
    })()`))) as Record<string, [number, number, number]>
    const near = (pixel: [number, number, number], red: number, green: number, blue: number): boolean => Math.abs(pixel[0] - red) < 90 && Math.abs(pixel[1] - green) < 90 && Math.abs(pixel[2] - blue) < 90
    expect(near(pixels.edgeDuring!, 25, 230, 0)).toBe(true)
    expect(near(pixels.centreDuring!, 255, 0, 0)).toBe(true)
    expect(near(pixels.edgeAfter!, 0, 0, 255)).toBe(true)
    expect(near(pixels.centreAfter!, 0, 0, 255)).toBe(true)
  }
  finally { view.close(); room.stop() }
}, 120_000)
