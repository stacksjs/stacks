/**
 * MP4 video without FFmpeg.
 *
 * A browser is already open whenever screens are captured or a story is
 * recorded, and every current browser can encode H.264 through WebCodecs. The
 * page encodes the pictures it is handed; ts-videos, which is plain
 * TypeScript, writes the MP4 container here. Nothing is installed or spawned.
 */
import { Mp4Muxer } from '@ts-videos/mp4'
import { BufferTarget } from 'ts-videos'

/** Runs a script in a page and resolves with its result, as Bun.WebView and a DevTools session both do. */
export type FilmEvaluate = (script: string) => Promise<unknown>

export interface BrowserFilmOptions {
  /** Frames per second of the finished video. */
  fps: number
  /** Frame size. Defaults to the first picture's size, rounded up to even numbers. */
  width?: number
  height?: number
  /** Target bits per second. Defaults to a rate that keeps interface text sharp. */
  bitrate?: number
}

/** A square outline drawn over a recording between two moments, in the recording's own pixels. */
export interface FilmMark { x: number, y: number, size: number, color: string, start: number, end: number }

export interface BrowserFilm {
  /** Show a PNG or JPEG for this many frames. Pass no picture to hold the previous one. */
  add: (picture: Uint8Array | undefined, frames: number) => Promise<void>
  /**
   * Re-time a recording the page can load (see `serveFilmStudio`'s files) to
   * this film's frame rate, drawing each mark while it is active. Resolves
   * with the recording's length in seconds.
   */
  addVideo: (url: string, marks?: FilmMark[]) => Promise<number>
  /** Finish encoding and return the MP4. */
  finish: () => Promise<Uint8Array>
  frames: () => number
}

/**
 * A blank page on localhost: WebCodecs needs a secure context, and localhost
 * is one. `files` maps a path such as `/raw.mp4` to a local file the page may
 * load, with byte ranges so a video element can seek in it.
 */
export function serveFilmStudio(files: Record<string, string> = {}): { url: string, stop: () => void } {
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) {
    const file = files[new URL(request.url).pathname]
    if (file) return new Response(Bun.file(file), { headers: { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' } })
    return new Response('<!doctype html><meta charset="utf-8"><title>Film</title>', { headers: { 'Content-Type': 'text/html' } })
  } })
  return { url: `http://127.0.0.1:${server.port}/`, stop: () => { void server.stop(true) } }
}

// H.264 in order of preference: High, Main, then Constrained Baseline, which a
// software encoder always has. Level 4.0 covers a desktop viewport; 5.1 covers
// a picture captured at two pixels per point.
const profiles = ['6400', '4d00', '42e0']

const studio = (options: BrowserFilmOptions): string => `(() => {
  if (window.__stacksFilm) return true
  const b64 = bytes => { let text = ''; for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(text) }
  const film = window.__stacksFilm = { chunks: [], description: null, error: null, frame: 0, encoder: null, canvas: null, context: null, width: 0, height: 0 }
  film.start = async (width, height) => {
    if (typeof VideoEncoder !== 'function') throw new Error('This browser has no WebCodecs video encoder')
    film.width = width; film.height = height
    const level = width * height > 2097152 ? '33' : '28'
    for (const profile of ${JSON.stringify(profiles)}) {
      const config = { codec: 'avc1.' + profile + level, width, height, bitrate: ${options.bitrate ?? 0} || Math.max(1500000, Math.round(width * height * 3)), framerate: ${options.fps}, avc: { format: 'avc' } }
      const support = await VideoEncoder.isConfigSupported(config).catch(() => null)
      if (!support || !support.supported) continue
      film.canvas = new OffscreenCanvas(width, height)
      film.context = film.canvas.getContext('2d')
      film.context.fillStyle = '#fff'; film.context.fillRect(0, 0, width, height)
      film.encoder = new VideoEncoder({
        output(chunk, meta) {
          const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes)
          const description = meta && meta.decoderConfig && meta.decoderConfig.description
          if (description) film.description = b64(new Uint8Array(description.buffer || description, description.byteOffset || 0, description.byteLength))
          film.chunks.push([chunk.type === 'key' ? 1 : 0, chunk.timestamp, b64(bytes)])
        },
        error(error) { film.error = String(error && error.message || error) },
      })
      film.encoder.configure(config)
      return
    }
    throw new Error('This browser cannot encode H.264 video at ' + width + ' by ' + height)
  }
  film.add = async (picture, type, frames) => {
    if (picture) {
      const bitmap = await createImageBitmap(await (await fetch('data:' + type + ';base64,' + picture)).blob())
      if (!film.encoder) await film.start(${options.width ? Math.ceil(options.width / 2) * 2 : 'Math.ceil(bitmap.width / 2) * 2'}, ${options.height ? Math.ceil(options.height / 2) * 2 : 'Math.ceil(bitmap.height / 2) * 2'})
      const scale = Math.min(film.width / bitmap.width, film.height / bitmap.height, 1)
      const [w, h] = [bitmap.width * scale, bitmap.height * scale]
      film.context.fillStyle = '#fff'; film.context.fillRect(0, 0, film.width, film.height)
      film.context.drawImage(bitmap, (film.width - w) / 2, (film.height - h) / 2, w, h)
      bitmap.close()
    }
    if (!film.encoder) throw new Error('A film starts with a picture')
    for (let i = 0; i < frames; i++) {
      const frame = new VideoFrame(film.canvas, { timestamp: Math.round(film.frame * 1e6 / ${options.fps}), duration: Math.round(1e6 / ${options.fps}) })
      // A key frame every two seconds keeps seeking quick without costing much.
      film.encoder.encode(frame, { keyFrame: film.frame % ${Math.max(1, Math.round(options.fps * 2))} === 0 })
      frame.close(); film.frame++
    }
    if (film.encoder.encodeQueueSize > 30) await film.encoder.flush()
    if (film.error) throw new Error(film.error)
  }
  film.open = async (url) => {
    const video = film.video = document.createElement('video')
    video.muted = true; video.playsInline = true; video.preload = 'auto'
    await new Promise((resolve, reject) => {
      video.addEventListener('loadeddata', resolve, { once: true })
      video.addEventListener('error', () => reject(new Error('This browser cannot play the recording')), { once: true })
      video.src = url
    })
    if (!video.videoWidth || !Number.isFinite(video.duration)) throw new Error('The recording has no picture')
    await film.start(Math.ceil(video.videoWidth / 2) * 2, Math.ceil(video.videoHeight / 2) * 2)
    return JSON.stringify({ seconds: video.duration, frames: Math.max(1, Math.round(video.duration * ${options.fps})) })
  }
  // One output frame per tick of this film's clock, each taken from the
  // recording at that moment: a device's variable frame rate becomes steady.
  film.copy = async (from, count, marks) => {
    const video = film.video
    for (let index = from; index < from + count; index++) {
      const time = Math.min(index / ${options.fps}, Math.max(0, video.duration - 0.001))
      if (Math.abs(video.currentTime - time) > 0.0005) {
        await new Promise((resolve, reject) => {
          video.addEventListener('seeked', resolve, { once: true })
          video.addEventListener('error', () => reject(new Error('The recording could not be read')), { once: true })
          video.currentTime = time
        })
      }
      film.context.fillStyle = '#fff'; film.context.fillRect(0, 0, film.width, film.height)
      film.context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight)
      for (const mark of marks) {
        if (time < mark.start || time > mark.end) continue
        film.context.globalAlpha = 0.9; film.context.strokeStyle = mark.color; film.context.lineWidth = 4
        film.context.strokeRect(Math.round(mark.x - mark.size / 2) + 2, Math.round(mark.y - mark.size / 2) + 2, mark.size - 4, mark.size - 4)
        film.context.globalAlpha = 1
      }
      const frame = new VideoFrame(film.canvas, { timestamp: Math.round(film.frame * 1e6 / ${options.fps}), duration: Math.round(1e6 / ${options.fps}) })
      film.encoder.encode(frame, { keyFrame: film.frame % ${Math.max(1, Math.round(options.fps * 2))} === 0 })
      frame.close(); film.frame++
    }
    await film.encoder.flush()
    if (film.error) throw new Error(film.error)
  }
  film.drain = async (last) => {
    if (last && film.encoder) { await film.encoder.flush(); film.encoder.close() }
    if (film.error) throw new Error(film.error)
    return JSON.stringify({ width: film.width, height: film.height, description: film.description, chunks: film.chunks.splice(0) })
  }
  return true
})()`

const pictureType = (bytes: Uint8Array): string => bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png' : 'image/jpeg'

/**
 * Encode pictures into an MP4 inside a page the caller already controls.
 * `evaluate` must await promises, and the page must be a secure context
 * (https, or localhost: see `serveFilmStudio`).
 */
export async function openBrowserFilm(evaluate: FilmEvaluate, options: BrowserFilmOptions): Promise<BrowserFilm> {
  if (!Number.isInteger(options.fps) || options.fps < 1 || options.fps > 60) throw new Error('Film frames per second must be an integer from 1 to 60')
  await evaluate(studio(options))
  const packets: Array<[number, number, Uint8Array]> = []
  let description: Uint8Array | undefined
  let size = { width: 0, height: 0 }
  let total = 0
  const drain = async (last: boolean): Promise<void> => {
    const part = JSON.parse(String(await evaluate(`window.__stacksFilm.drain(${last})`))) as { width: number, height: number, description: string | null, chunks: Array<[number, number, string]> }
    size = { width: part.width, height: part.height }
    if (part.description) description = new Uint8Array(Buffer.from(part.description, 'base64'))
    for (const [key, timestamp, data] of part.chunks) packets.push([key, timestamp, new Uint8Array(Buffer.from(data, 'base64'))])
  }
  return {
    frames: () => total,
    async add(picture, frames) {
      if (!Number.isInteger(frames) || frames < 1) return
      const data = picture ? `${JSON.stringify(Buffer.from(picture).toString('base64'))}, ${JSON.stringify(pictureType(picture))}` : 'null, null'
      await evaluate(`window.__stacksFilm.add(${data}, ${frames})`)
      total += frames
      // Keep the page's memory flat on a long film.
      if (total % (options.fps * 20) < frames) await drain(false)
    },
    async addVideo(url, marks = []) {
      for (const mark of marks) {
        if (![mark.x, mark.y, mark.size, mark.start, mark.end].every(Number.isFinite) || !/^#[0-9a-f]{6}$/i.test(mark.color)) throw new Error('Invalid film mark')
      }
      const opened = JSON.parse(String(await evaluate(`window.__stacksFilm.open(${JSON.stringify(url)})`))) as { seconds: number, frames: number }
      // A second of output per call keeps each round trip, and the page's memory, small.
      for (let from = 0; from < opened.frames; from += options.fps) {
        const count = Math.min(options.fps, opened.frames - from)
        await evaluate(`window.__stacksFilm.copy(${from}, ${count}, ${JSON.stringify(marks)})`)
        total += count
        await drain(false)
      }
      return opened.seconds
    },
    async finish() {
      await drain(true)
      if (!packets.length || !description) throw new Error('The browser encoded no video')
      const target = new BufferTarget()
      const muxer = new Mp4Muxer(target)
      const track = muxer.addVideoTrack({ codec: 'h264', width: size.width, height: size.height, frameRate: options.fps, codecDescription: description })
      for (const [key, timestamp, data] of packets) await muxer.writePacket(track.id, { data, timestamp: timestamp / 1e6, duration: 1 / options.fps, isKeyframe: key === 1 })
      await muxer.finalize()
      return target.buffer
    },
  }
}
