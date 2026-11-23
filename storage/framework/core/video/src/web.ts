/**
 * One web-ready MP4 and a poster from any upload, encoded with ffmpeg.
 *
 * ts-videos plans and inspects, but it cannot encode in Bun: its `convert()`
 * only remuxes, and its transcode and poster paths need WebCodecs and
 * OffscreenCanvas, which Bun does not have. So the encoder is ffmpeg, and this
 * module decides everything ffmpeg is told: the size, the frame rate, the
 * colour conversion, and what metadata survives (none of it).
 *
 * A phone upload is the case it is shaped around: HEVC in a QuickTime file,
 * often 10-bit HLG or Dolby Vision HDR, stored landscape with a rotation matrix
 * that makes it portrait on screen, carrying the GPS position it was filmed at.
 * The output is H.264 High@4.0 in an MP4 with its index first, BT.709 SDR,
 * rotation applied to the pixels, and no location or other metadata.
 */

import { spawn } from 'node:child_process'
import { rename, rm, stat } from 'node:fs/promises'
import process from 'node:process'

/** What ffprobe says about a video file, in the terms the transcoder needs. */
export interface VideoProbe {
  /** Coded size, as stored. */
  codedWidth: number
  codedHeight: number
  /** Size on screen, after the rotation matrix is applied. */
  width: number
  height: number
  /** Clockwise degrees the frames are turned for display: 0, 90, 180 or 270. */
  rotation: number
  /** Seconds. */
  duration: number
  /** Frames per second, from the stream's average rate. */
  frameRate: number
  videoCodec: string
  audioCodec?: string
  hasAudio: boolean
  pixelFormat?: string
  /** The stream's transfer characteristics, e.g. `arib-std-b67` (HLG) or `smpte2084` (PQ). */
  transfer?: string
  primaries?: string
  matrix?: string
  /** Dolby Vision configuration present. */
  dolbyVision: boolean
  /** PQ, HLG or Dolby Vision: needs tone-mapping to SDR. */
  hdr: boolean
}

/** Where ffmpeg and ffprobe live, and how to run them. */
export interface FfmpegOptions {
  /** ffmpeg binary. Default: `VIDEO_FFMPEG`, else `ffmpeg` on PATH. */
  ffmpeg?: string
  /** ffprobe binary. Default: `VIDEO_FFPROBE`, else `ffprobe` beside `ffmpeg` when that is a path, else on PATH. */
  ffprobe?: string
  /** Kill the process group after this long. Default 10 minutes for a transcode, 1 minute otherwise. */
  timeoutMs?: number
  /** `nice` level the encoder runs at (POSIX). Default 10; 0 runs it as is. */
  nice?: number
}

export interface WebTranscodeOptions extends FfmpegOptions {
  /** The landscape box the output fits inside; a portrait video gets it turned. Default `[1280, 720]`. */
  maxBox?: readonly [number, number]
  /** Frame rate cap. A source above it is resampled to it; one at or below it keeps its own. Default 30. */
  fps?: number
  /** x264 constant rate factor. Default 23. */
  crf?: number
  /** Peak video bitrate in kbit/s; the buffer is twice it. Default 3000. */
  maxrateKbps?: number
  /** Keyframe interval in frames. Default 60. */
  gop?: number
  /** Encoder threads. Default ffmpeg's choice. */
  threads?: number
}

export interface PosterOptions extends FfmpegOptions {
  /** Seconds into the video. Default `min(1, duration / 3)`. */
  at?: number
  /** Same meaning as for the transcode, so the poster matches the video. Default `[1280, 720]`. */
  maxBox?: readonly [number, number]
}

/** What was written, measured from the file itself. */
export interface WebVideoOutput {
  path: string
  width: number
  height: number
  duration: number
  frameRate: number
  bytes: number
}

export interface PosterOutput {
  path: string
  width: number
  height: number
  bytes: number
}

/** Which tone-mapping an ffmpeg build can do. */
export interface FfmpegCapabilities {
  /** swscale colour management in the `scale` filter (ffmpeg 8 and later). */
  swscaleColor: boolean
  /** The `zscale` and `tonemap` filters (built with zimg). */
  zscale: boolean
}

const HDR_TRANSFERS = new Set(['smpte2084', 'arib-std-b67'])

/** How long reading a file's streams may take, apart from any encode's budget. */
const PROBE_TIMEOUT_MS = 60_000

/** The binaries to run, from explicit options, then the environment, then PATH. */
export function resolveFfmpegBinaries(options: FfmpegOptions = {}, env: NodeJS.ProcessEnv = process.env): { ffmpeg: string, ffprobe: string } {
  const ffmpeg = options.ffmpeg || env.VIDEO_FFMPEG || 'ffmpeg'
  const sibling = ffmpeg.includes('/') ? ffmpeg.replace(/ffmpeg([^/]*)$/, 'ffprobe$1') : undefined
  const ffprobe = options.ffprobe || env.VIDEO_FFPROBE || (sibling && sibling !== ffmpeg ? sibling : 'ffprobe')
  return { ffmpeg, ffprobe }
}

interface RunResult { code: number | null, stdout: string, stderr: string, timedOut: boolean }

/**
 * Run a command in its own process group, under `nice`, and kill the whole
 * group when it outlives `timeoutMs`: ffmpeg's encoder threads and any child
 * it starts go with it, rather than lingering after a timeout.
 */
function run(command: string[], timeoutMs: number, niceLevel: number): Promise<RunResult> {
  const argv = niceLevel > 0 && process.platform !== 'win32' ? ['nice', '-n', String(niceLevel), ...command] : command
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0]!, argv.slice(1), { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    child.stdout.on('data', (chunk) => { stdout += chunk })
    // Only the tail of stderr matters for an error message, and a long encode
    // writes a lot of it.
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-16_384) })
    const timer = setTimeout(() => {
      timedOut = true
      try { process.kill(child.pid !== undefined && process.platform !== 'win32' ? -child.pid : child.pid!, 'SIGKILL') }
      catch { child.kill('SIGKILL') }
    }, timeoutMs)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
  })
}

function failure(what: string, result: RunResult, timeoutMs: number): Error {
  if (result.timedOut)
    return new Error(`${what} timed out after ${timeoutMs} ms and was killed`)
  const tail = result.stderr.trim().split('\n').slice(-6).join('\n')
  return new Error(`${what} failed (exit ${result.code})${tail ? `:\n${tail}` : ''}`)
}

interface FfprobeStream {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  pix_fmt?: string
  color_transfer?: string
  color_primaries?: string
  color_space?: string
  avg_frame_rate?: string
  r_frame_rate?: string
  duration?: string
  tags?: Record<string, string>
  side_data_list?: Array<{ side_data_type?: string, rotation?: number }>
}

function rate(value: string | undefined): number {
  if (!value) return 0
  const [numerator, denominator] = value.split('/').map(Number)
  if (!numerator || !Number.isFinite(numerator)) return 0
  return denominator ? numerator / denominator : numerator
}

/** Clockwise display rotation, normalised to 0, 90, 180 or 270. */
function displayRotation(stream: FfprobeStream): number {
  const matrix = stream.side_data_list?.find(item => typeof item.rotation === 'number')?.rotation
  // ffprobe reports the display matrix counter-clockwise (an iPhone portrait
  // clip says -90); the legacy `rotate` tag is clockwise.
  const clockwise = typeof matrix === 'number' ? -matrix : Number(stream.tags?.rotate ?? 0)
  return ((Math.round(clockwise / 90) * 90) % 360 + 360) % 360
}

/** The parts of ffprobe's JSON this module reads, shaped into a probe. */
export function parseProbe(json: string): VideoProbe {
  const data = JSON.parse(json) as { streams?: FfprobeStream[], format?: { duration?: string } }
  const streams = data.streams ?? []
  const video = streams.find(stream => stream.codec_type === 'video')
  if (!video || !video.width || !video.height)
    throw new Error('No video stream in this file')
  const audio = streams.find(stream => stream.codec_type === 'audio')
  const rotation = displayRotation(video)
  const quarterTurn = rotation === 90 || rotation === 270
  const dolbyVision = Boolean(video.side_data_list?.some(item => /dovi|dolby vision/i.test(item.side_data_type ?? '')))
  const transfer = video.color_transfer
  return {
    codedWidth: video.width,
    codedHeight: video.height,
    width: quarterTurn ? video.height : video.width,
    height: quarterTurn ? video.width : video.height,
    rotation,
    duration: Number(data.format?.duration ?? video.duration ?? 0) || 0,
    frameRate: rate(video.avg_frame_rate) || rate(video.r_frame_rate),
    videoCodec: video.codec_name ?? 'unknown',
    audioCodec: audio?.codec_name,
    hasAudio: Boolean(audio),
    pixelFormat: video.pix_fmt,
    transfer,
    primaries: video.color_primaries,
    matrix: video.color_space,
    dolbyVision,
    hdr: dolbyVision || HDR_TRANSFERS.has(transfer ?? ''),
  }
}

/** Probe a file with ffprobe: rotation, HDR transfer, frame rate and codecs. */
export async function probeVideo(input: string, options: FfmpegOptions = {}): Promise<VideoProbe> {
  const { ffprobe } = resolveFfmpegBinaries(options)
  const timeoutMs = options.timeoutMs ?? 60_000
  const result = await run([ffprobe, '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', input], timeoutMs, 0)
  if (result.code !== 0)
    throw failure(`ffprobe ${input}`, result, timeoutMs)
  return parseProbe(result.stdout)
}

const capabilityCache = new Map<string, Promise<FfmpegCapabilities>>()

/** What this ffmpeg can tone-map with, asked of the binary itself, once per path. */
export function ffmpegCapabilities(options: FfmpegOptions = {}): Promise<FfmpegCapabilities> {
  const { ffmpeg } = resolveFfmpegBinaries(options)
  let cached = capabilityCache.get(ffmpeg)
  if (!cached) {
    cached = (async () => {
      const [scale, filters] = await Promise.all([
        run([ffmpeg, '-hide_banner', '-h', 'filter=scale'], 30_000, 0),
        run([ffmpeg, '-hide_banner', '-filters'], 30_000, 0),
      ])
      if (filters.code !== 0)
        throw failure(`${ffmpeg} -filters`, filters, 30_000)
      return {
        swscaleColor: /out_transfer/.test(scale.stdout) && /out_primaries/.test(scale.stdout),
        zscale: /\szscale\s/.test(filters.stdout) && /\stonemap\s/.test(filters.stdout),
      }
    })()
    capabilityCache.set(ffmpeg, cached)
    cached.catch(() => capabilityCache.delete(ffmpeg))
  }
  return cached
}

const even = (value: number): number => Math.max(2, Math.floor(value / 2) * 2)

/**
 * The size a video is shown at once it fits inside `maxBox`: the box is turned
 * for a portrait video, nothing is upscaled, and both sides are even, which
 * yuv420p requires.
 */
export function fitInsideBox(width: number, height: number, maxBox: readonly [number, number] = [1280, 720]): { width: number, height: number } {
  const [long, short] = maxBox[0] >= maxBox[1] ? maxBox : [maxBox[1], maxBox[0]]
  const [boxWidth, boxHeight] = height > width ? [short, long] : [long, short]
  const factor = Math.min(1, boxWidth / width, boxHeight / height)
  return { width: even(width * factor), height: even(height * factor) }
}

/**
 * The scale and colour conversion, shared by the video and its poster.
 *
 * ffmpeg turns the frames by the rotation matrix before this runs (autorotate
 * is on by default), so `size` is the displayed one and the output carries no
 * matrix. HDR is tone-mapped to BT.709 SDR: with swscale's colour management on
 * ffmpeg 8 and later, else zscale and tonemap. An SDR source is converted to
 * BT.709 too, so a Display P3 phone clip is not shown with the wrong primaries.
 */
export function colourFilters(probe: Pick<VideoProbe, 'hdr'>, size: { width: number, height: number }, capabilities: FfmpegCapabilities, range: 'tv' | 'pc' = 'tv'): string[] {
  const scaled = `scale=w=${size.width}:h=${size.height}`
  if (capabilities.swscaleColor)
    return [`${scaled}:out_color_matrix=bt709:out_primaries=bt709:out_transfer=bt709:out_range=${range}${probe.hdr ? ':intent=perceptual' : ''}`]
  if (probe.hdr) {
    if (!capabilities.zscale)
      throw new Error('This video is HDR, and this ffmpeg can tone-map it neither with swscale colour management (ffmpeg 8 or later) nor with zscale. Install a build with either.')
    return [
      'zscale=t=linear:npl=100',
      'format=gbrpf32le',
      'zscale=p=bt709',
      'tonemap=tonemap=hable:desat=0',
      `zscale=t=bt709:m=bt709:r=${range === 'tv' ? 'tv' : 'pc'}`,
      scaled,
    ]
  }
  return [`${scaled}:out_color_matrix=bt709:out_range=${range}`]
}

/** Everything ffmpeg is told for a web transcode, after `-i input`. */
export function webTranscodeArgs(probe: VideoProbe, capabilities: FfmpegCapabilities, options: WebTranscodeOptions = {}): string[] {
  const fps = options.fps ?? 30
  const size = fitInsideBox(probe.width, probe.height, options.maxBox)
  const filters = [
    // Resample only a source above the cap; one at 24 or 25 keeps its rate.
    ...(probe.frameRate > fps + 0.01 ? [`fps=${fps}`] : []),
    ...colourFilters(probe, size, capabilities, 'tv'),
    'format=yuv420p',
  ]
  const maxrate = options.maxrateKbps ?? 3000
  return [
    '-map', '0:v:0',
    '-map', '0:a:0?',
    // No metadata of the source's survives: not its GPS position, its device,
    // its chapters, nor any data or subtitle stream.
    '-map_metadata', '-1',
    '-map_metadata:s', '-1',
    '-map_chapters', '-1',
    '-dn',
    '-sn',
    '-vf', filters.join(','),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-profile:v', 'high',
    '-level:v', '4.0',
    '-pix_fmt', 'yuv420p',
    '-crf', String(options.crf ?? 23),
    '-maxrate', `${maxrate}k`,
    '-bufsize', `${maxrate * 2}k`,
    '-g', String(options.gop ?? 60),
    '-color_primaries', 'bt709',
    '-color_trc', 'bt709',
    '-colorspace', 'bt709',
    '-color_range', 'tv',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ac', '2',
    '-ar', '48000',
    '-movflags', '+faststart',
    ...(options.threads ? ['-threads', String(options.threads)] : []),
  ]
}

/** Where an output is written until it is complete, so a failed run never leaves a half file at `output`. */
function partialPath(output: string): string {
  const dot = output.lastIndexOf('.')
  return dot > output.lastIndexOf('/') ? `${output.slice(0, dot)}.partial${output.slice(dot)}` : `${output}.partial`
}

/**
 * Re-encode `input` as one web-ready MP4 at `output`.
 *
 * Every upload is re-encoded, an H.264 MP4 included: that is what strips its
 * metadata and guarantees the profile, size and colour the player gets.
 * Returns the output's real size, duration and frame rate, read back from the
 * file written.
 */
export async function transcodeForWeb(input: string, output: string, options: WebTranscodeOptions = {}): Promise<WebVideoOutput> {
  const { ffmpeg } = resolveFfmpegBinaries(options)
  // Probing is quick whatever the encode's budget is; `timeoutMs` is the encode's.
  const [probe, capabilities] = await Promise.all([probeVideo(input, { ...options, timeoutMs: PROBE_TIMEOUT_MS }), ffmpegCapabilities(options)])
  const timeoutMs = options.timeoutMs ?? 10 * 60_000
  const partial = partialPath(output)
  const result = await run([ffmpeg, '-hide_banner', '-nostdin', '-loglevel', 'error', '-y', '-i', input, ...webTranscodeArgs(probe, capabilities, options), '-f', 'mp4', partial], timeoutMs, options.nice ?? 10)
  if (result.code !== 0) {
    await rm(partial, { force: true })
    throw failure(`Transcoding ${input}`, result, timeoutMs)
  }
  await rename(partial, output)
  const written = await probeVideo(output, { ...options, timeoutMs: PROBE_TIMEOUT_MS })
  return { path: output, width: written.width, height: written.height, duration: written.duration, frameRate: written.frameRate, bytes: (await stat(output)).size }
}

/**
 * One JPEG frame of `input` at `output`, at the size and colour the web
 * transcode gives the video, taken `min(1s, duration / 3)` in by default.
 */
export async function posterFrame(input: string, output: string, options: PosterOptions = {}): Promise<PosterOutput> {
  const { ffmpeg } = resolveFfmpegBinaries(options)
  const [probe, capabilities] = await Promise.all([probeVideo(input, { ...options, timeoutMs: PROBE_TIMEOUT_MS }), ffmpegCapabilities(options)])
  const at = Math.max(0, options.at ?? Math.min(1, probe.duration / 3))
  const size = fitInsideBox(probe.width, probe.height, options.maxBox)
  const filters = [...colourFilters(probe, size, capabilities, 'pc'), 'format=yuvj420p']
  const timeoutMs = options.timeoutMs ?? 60_000
  const partial = partialPath(output)
  const result = await run([
    ffmpeg, '-hide_banner', '-nostdin', '-loglevel', 'error', '-y',
    '-ss', at.toFixed(3), '-i', input,
    '-map', '0:v:0', '-map_metadata', '-1', '-frames:v', '1',
    '-vf', filters.join(','), '-q:v', '3', '-f', 'image2', '-c:v', 'mjpeg', partial,
  ], timeoutMs, options.nice ?? 10)
  if (result.code !== 0) {
    await rm(partial, { force: true })
    throw failure(`Taking a poster from ${input}`, result, timeoutMs)
  }
  await rename(partial, output)
  const written = await probeVideo(output, { ...options, timeoutMs: PROBE_TIMEOUT_MS })
  return { path: output, width: written.width, height: written.height, bytes: (await stat(output)).size }
}
