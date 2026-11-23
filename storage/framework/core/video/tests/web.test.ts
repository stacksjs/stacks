import { describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { colourFilters, fitInsideBox, parseProbe, posterFrame, probeVideo, resolveFfmpegBinaries, transcodeForWeb, webTranscodeArgs } from '../src/index'
import type { VideoProbe } from '../src/index'

/**
 * The ffmpeg-backed web conversion: one H.264 MP4 and a JPEG poster from any
 * upload. ts-videos cannot encode in Bun (no WebCodecs), so ffmpeg does, and
 * these pin what it is told and what comes out.
 */

const FIXTURES = join(import.meta.dir, 'fixtures')
const SWSCALE = { swscaleColor: true, zscale: false }
const ZSCALE = { swscaleColor: false, zscale: true }

function probe(overrides: Partial<VideoProbe> = {}): VideoProbe {
  return { codedWidth: 1920, codedHeight: 1080, width: 1920, height: 1080, rotation: 0, duration: 10, frameRate: 30, videoCodec: 'h264', audioCodec: 'aac', hasAudio: true, dolbyVision: false, hdr: false, ...overrides }
}

describe('fitting inside the box', () => {
  test('landscape fits 1280x720 and portrait fits 720x1280', () => {
    expect(fitInsideBox(3840, 2160)).toEqual({ width: 1280, height: 720 })
    expect(fitInsideBox(2160, 3840)).toEqual({ width: 720, height: 1280 })
    expect(fitInsideBox(1080, 1080)).toEqual({ width: 720, height: 720 })
  })

  test('never upscales, and keeps both sides even', () => {
    expect(fitInsideBox(640, 360)).toEqual({ width: 640, height: 360 })
    expect(fitInsideBox(1206, 2622)).toEqual({ width: 588, height: 1280 })
    expect(fitInsideBox(641, 361)).toEqual({ width: 640, height: 360 })
  })

  test('the box may be given either way round', () => {
    expect(fitInsideBox(2160, 3840, [720, 1280])).toEqual({ width: 720, height: 1280 })
  })
})

describe('reading ffprobe', () => {
  const iphone = JSON.stringify({
    streams: [
      { codec_type: 'video', codec_name: 'hevc', width: 3840, height: 2160, pix_fmt: 'yuv420p10le', color_transfer: 'arib-std-b67', color_primaries: 'bt2020', color_space: 'bt2020nc', avg_frame_rate: '60/1', side_data_list: [{ side_data_type: 'Display Matrix', rotation: -90 }] },
      { codec_type: 'audio', codec_name: 'aac' },
    ],
    format: { duration: '1.000000' },
  })

  test('a portrait iPhone clip is portrait, HLG, 60 fps', () => {
    const result = parseProbe(iphone)
    expect(result).toMatchObject({ codedWidth: 3840, codedHeight: 2160, width: 2160, height: 3840, rotation: 90, frameRate: 60, videoCodec: 'hevc', audioCodec: 'aac', transfer: 'arib-std-b67', hdr: true, dolbyVision: false, duration: 1 })
  })

  test('PQ and Dolby Vision are HDR; BT.709 is not', () => {
    const one = (stream: object) => parseProbe(JSON.stringify({ streams: [{ codec_type: 'video', width: 1920, height: 1080, ...stream }] }))
    expect(one({ color_transfer: 'smpte2084' }).hdr).toBe(true)
    expect(one({ side_data_list: [{ side_data_type: 'DOVI configuration record' }] })).toMatchObject({ hdr: true, dolbyVision: true })
    expect(one({ color_transfer: 'bt709' }).hdr).toBe(false)
    expect(one({ tags: { rotate: '270' } })).toMatchObject({ rotation: 270, width: 1080, height: 1920 })
  })

  test('a file with no video is refused', () => {
    expect(() => parseProbe(JSON.stringify({ streams: [{ codec_type: 'audio' }] }))).toThrow('No video stream')
  })
})

describe('what ffmpeg is told', () => {
  test('fps is capped only above 30', () => {
    expect(webTranscodeArgs(probe({ frameRate: 59.94 }), SWSCALE).join(' ')).toContain('-vf fps=30,')
    expect(webTranscodeArgs(probe({ frameRate: 30 }), SWSCALE).join(' ')).not.toContain('fps=')
    expect(webTranscodeArgs(probe({ frameRate: 24 }), SWSCALE).join(' ')).not.toContain('fps=')
  })

  test('H.264 High@4.0, BT.709, AAC stereo 48 kHz, index first, no metadata', () => {
    const args = webTranscodeArgs(probe(), SWSCALE).join(' ')
    for (const flag of ['-c:v libx264', '-profile:v high', '-level:v 4.0', '-pix_fmt yuv420p', '-crf 23', '-maxrate 3000k', '-bufsize 6000k', '-g 60', '-color_primaries bt709', '-color_trc bt709', '-colorspace bt709', '-c:a aac', '-b:a 128k', '-ac 2', '-ar 48000', '-movflags +faststart', '-map_metadata -1', '-map_chapters -1', '-dn', '-sn'])
      expect(args).toContain(flag)
  })

  test('HDR is tone-mapped with swscale colour management where it exists', () => {
    expect(colourFilters({ hdr: true }, { width: 720, height: 1280 }, SWSCALE)).toEqual(['scale=w=720:h=1280:out_color_matrix=bt709:out_primaries=bt709:out_transfer=bt709:out_range=tv:intent=perceptual'])
  })

  test('and with zscale and tonemap where only those exist', () => {
    const chain = colourFilters({ hdr: true }, { width: 720, height: 1280 }, ZSCALE).join(',')
    expect(chain).toContain('tonemap=tonemap=hable')
    expect(chain).toContain('zscale=t=bt709:m=bt709:r=tv')
    expect(chain.endsWith('scale=w=720:h=1280')).toBe(true)
  })

  test('HDR with neither is refused rather than shown with the wrong colours', () => {
    expect(() => colourFilters({ hdr: true }, { width: 720, height: 1280 }, { swscaleColor: false, zscale: false })).toThrow('tone-map')
  })

  test('ffmpeg comes from the option, then VIDEO_FFMPEG, then PATH; ffprobe sits beside it', () => {
    expect(resolveFfmpegBinaries({}, {})).toEqual({ ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' })
    expect(resolveFfmpegBinaries({}, { VIDEO_FFMPEG: '/opt/ffmpeg/bin/ffmpeg' })).toEqual({ ffmpeg: '/opt/ffmpeg/bin/ffmpeg', ffprobe: '/opt/ffmpeg/bin/ffprobe' })
    expect(resolveFfmpegBinaries({ ffmpeg: '/a/ffmpeg', ffprobe: '/b/ffprobe' }, { VIDEO_FFMPEG: '/c/ffmpeg' })).toEqual({ ffmpeg: '/a/ffmpeg', ffprobe: '/b/ffprobe' })
    expect(resolveFfmpegBinaries({}, { VIDEO_FFMPEG: '/x/ffmpeg', VIDEO_FFPROBE: '/y/ffprobe' })).toEqual({ ffmpeg: '/x/ffmpeg', ffprobe: '/y/ffprobe' })
  })
})

/** The top-level MP4 boxes, in order. */
function topLevelBoxes(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const boxes: string[] = []
  for (let offset = 0; offset + 8 <= bytes.length;) {
    let size = view.getUint32(offset)
    if (size === 1) size = Number(view.getBigUint64(offset + 8))
    boxes.push(String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)))
    if (size < 8) break
    offset += size
  }
  return boxes
}

const ffmpegAvailable = Bun.spawnSync([resolveFfmpegBinaries().ffmpeg, '-version'], { stdout: 'ignore', stderr: 'ignore' }).exitCode === 0
  && Bun.spawnSync([resolveFfmpegBinaries().ffprobe, '-version'], { stdout: 'ignore', stderr: 'ignore' }).exitCode === 0
if (!ffmpegAvailable)
  console.warn('[video] ffmpeg/ffprobe not found: the encoding tests below are skipped')

describe.skipIf(!ffmpegAvailable)('encoding with ffmpeg', () => {
  test('an HLG portrait 4K 60 fps upload with GPS becomes a 720x1280 30 fps SDR MP4 with no location', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-video-web-'))
    try {
      const input = join(FIXTURES, 'hlg-portrait.mov')
      const source = await probeVideo(input)
      expect(source).toMatchObject({ width: 2160, height: 3840, rotation: 90, frameRate: 60, hdr: true, transfer: 'arib-std-b67' })

      const output = join(directory, 'out.mp4')
      const result = await transcodeForWeb(input, output, { nice: 0 })
      expect(result).toMatchObject({ path: output, width: 720, height: 1280, frameRate: 30 })
      expect(result.duration).toBeGreaterThan(0.9)
      expect(result.bytes).toBe(readFileSync(output).byteLength)

      const streams = JSON.parse(Bun.spawnSync([resolveFfmpegBinaries().ffprobe, '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', output]).stdout.toString())
      const video = streams.streams.find((stream: { codec_type: string }) => stream.codec_type === 'video')
      const audio = streams.streams.find((stream: { codec_type: string }) => stream.codec_type === 'audio')
      expect(video).toMatchObject({ codec_name: 'h264', profile: 'High', level: 40, pix_fmt: 'yuv420p', width: 720, height: 1280, color_primaries: 'bt709', color_transfer: 'bt709', color_space: 'bt709', color_range: 'tv' })
      expect(video.side_data_list ?? []).toEqual([])
      expect(audio).toMatchObject({ codec_name: 'aac', sample_rate: '48000', channels: 2 })
      expect(Object.keys(streams.format.tags ?? {}).filter(key => /location/i.test(key))).toEqual([])

      const bytes = new Uint8Array(readFileSync(output))
      const text = new TextDecoder('latin1').decode(bytes)
      expect(text).not.toContain('+37.7749')
      expect(text).not.toContain('©xyz')
      const boxes = topLevelBoxes(bytes)
      expect(boxes.indexOf('moov')).toBeGreaterThan(-1)
      expect(boxes.indexOf('moov')).toBeLessThan(boxes.indexOf('mdat'))
      expect(readdirSync(directory)).toEqual(['out.mp4'])
    }
    finally { rmSync(directory, { recursive: true, force: true }) }
  }, 120_000)

  test('its poster is one JPEG at the same size', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-video-poster-'))
    try {
      const output = join(directory, 'poster.jpg')
      const result = await posterFrame(join(FIXTURES, 'hlg-portrait.mov'), output, { nice: 0 })
      expect(result).toMatchObject({ path: output, width: 720, height: 1280 })
      const bytes = readFileSync(output)
      expect([bytes[0], bytes[1]]).toEqual([0xFF, 0xD8])
      expect(result.bytes).toBe(bytes.byteLength)
    }
    finally { rmSync(directory, { recursive: true, force: true }) }
  }, 60_000)

  test('an SDR phone clip keeps its 15 fps and is not upscaled', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-video-sdr-'))
    try {
      const result = await transcodeForWeb(join(FIXTURES, 'phone-clip.mov'), join(directory, 'out.mp4'), { nice: 0 })
      expect(result).toMatchObject({ width: 588, height: 1280, frameRate: 15 })
    }
    finally { rmSync(directory, { recursive: true, force: true }) }
  }, 120_000)

  test('a run past its timeout is killed and leaves nothing behind', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-video-timeout-'))
    try {
      const output = join(directory, 'out.mp4')
      await expect(transcodeForWeb(join(FIXTURES, 'hlg-portrait.mov'), output, { nice: 0, timeoutMs: 50 })).rejects.toThrow(/^Transcoding .* timed out after 50 ms/)
      expect(existsSync(output)).toBe(false)
      expect(readdirSync(directory)).toEqual([])
      // The process group went with it: no ffmpeg is left writing here.
      expect(Bun.spawnSync(['pgrep', '-f', directory]).stdout.toString().trim()).toBe('')
    }
    finally { rmSync(directory, { recursive: true, force: true }) }
  }, 60_000)
})

test('the encoding tests ran here, or say why not', () => {
  // A skipped suite must not read as a passing one on a machine meant to run it.
  if (process.env.STACKS_REQUIRE_FFMPEG === '1')
    expect(ffmpegAvailable).toBe(true)
})
