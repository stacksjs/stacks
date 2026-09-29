import type { VideoAudioCodec, VideoCodec, VideoContainer, VideoProfile } from './index'
import { Mp4InputFormat, MovInputFormat } from '@ts-videos/mp4'
import { WebmInputFormat } from '@ts-videos/webm'
import { BufferSource, Input } from 'ts-videos'

/**
 * What a video file holds, read from its container with ts-videos: the
 * profile `video(source).profile(...)` asks for, for an upload.
 *
 * ts-videos reads a container only through the formats it is handed, and its
 * own list starts empty, so this hands it MP4, QuickTime and WebM. A phone's
 * clip is QuickTime (`ftyp qt  `), not MP4.
 */
export interface VideoInspection extends VideoProfile {
  /** 'mp4', 'mov' or 'webm', as the container says. */
  format: string
}

const VIDEO_CODECS: Record<string, VideoCodec> = { h264: 'h264', avc: 'h264', avc1: 'h264', h265: 'h265', hevc: 'h265', hvc1: 'h265', hev1: 'h265', vp8: 'vp8', vp9: 'vp9', av1: 'av1', prores: 'prores' }
const AUDIO_CODECS: Record<string, VideoAudioCodec> = { aac: 'aac', mp3: 'mp3', opus: 'opus', vorbis: 'vorbis', flac: 'flac', alac: 'alac', ac3: 'ac3', eac3: 'eac3' }

/** The profile of a video file, or null when it holds no video ts-videos can read. */
export async function inspectVideo(bytes: Uint8Array | ArrayBuffer): Promise<VideoInspection | null> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const input = new Input({ source: new BufferSource(data), formats: [new Mp4InputFormat(), new MovInputFormat(), new WebmInputFormat()] })
  try {
    const track = await input.getPrimaryVideoTrack()
    if (!track)
      return null
    const audio = await input.getPrimaryAudioTrack().catch(() => null)
    const format = await input.getFormatName().catch(() => '')
    const duration = await input.getDuration().catch(() => Number.NaN)
    const container: VideoContainer = format === 'webm' ? 'webm' : 'mp4'
    return {
      format,
      container,
      width: track.displayWidth || track.width,
      height: track.displayHeight || track.height,
      duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) / 1000 : 0,
      // Containers often leave the rate out; 30 is what a plan assumes then.
      frameRate: track.frameRate && track.frameRate > 0 ? track.frameRate : 30,
      videoCodec: VIDEO_CODECS[String(track.codec).toLowerCase()] ?? 'unknown',
      ...(audio ? { audioCodec: AUDIO_CODECS[String(audio.codec).toLowerCase()] ?? 'unknown' } : {}),
      hasAudio: !!audio,
    }
  }
  catch {
    return null
  }
  finally {
    await input.close().catch(() => {})
  }
}
