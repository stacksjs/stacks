import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/queue'
import { Storage } from '@stacksjs/storage'
import { video } from '@stacksjs/video'
import { runTask } from '../Actions/Dashboard/Content/file-metadata'
import { databaseMetadataStore } from '../Actions/Dashboard/Content/file-metadata-store'
import { VARIANT_PREFIX } from './OptimizeStorageImageJob'

/**
 * Transcode an uploaded video to mp4 and HLS (stacksjs/stacks#2578).
 *
 * #2578 asked whether video was in scope at all, on the grounds that mp4 and
 * HLS mean ffmpeg - a heavyweight external binary, its licensing, and its
 * provisioning across every deploy target. That question is already answered
 * here: `@stacksjs/video` is built on `ts-videos`, which does the encoding
 * itself, so there is no external binary to provision and no licence to take a
 * view on. The decision the issue wanted made was made before it was written.
 *
 * Renditions and the HLS playlist go to the same disk under `.variants/`,
 * alongside the image variants and hidden from the listing for the same reason.
 *
 * The profile has to be supplied by the caller. `ts-videos` can inspect a file,
 * but the dashboard already knows the dimensions it needs from the upload, and
 * a job that guesses wrong builds a ladder nobody asked for.
 */
interface TranscodeStorageVideoPayload {
  disk: string
  path: string
  profile: Parameters<ReturnType<typeof video>['profile']>[0]
  /** Cap the ladder at this height. Omit for every rung up to the source. */
  maxHeight?: number
}

export default new Job({
  name: 'TranscodeStorageVideo',
  description: 'Transcode an uploaded video to mp4 and HLS (background)',
  queue: 'media',
  // Fewer tries than the image job: a transcode is minutes of CPU, and a video
  // that fails three times is not going to succeed on a fourth.
  tries: 2,
  backoff: [60, 300],

  async handle(payload: TranscodeStorageVideoPayload) {
    if (!payload?.disk || !payload?.path)
      throw new Error('[TranscodeStorageVideo] payload.disk and payload.path are required')
    if (!payload?.profile)
      throw new Error('[TranscodeStorageVideo] payload.profile is required - the ladder is derived from it')

    return await runTask(databaseMetadataStore, payload.disk, payload.path, 'transcode', async () => {
      const adapter = Storage.disk(payload.disk)
      const staging = await mkdtemp(join(tmpdir(), 'stacks-transcode-'))

      try {
        const source = join(staging, basename(payload.path))
        await writeFile(source, await adapter.readToBuffer(payload.path))

        const delivery = await video(source)
          .profile(payload.profile)
          .ladder(payload.maxHeight ?? 'auto')
          .output(['mp4'])
          .streaming(['hls'])
          .process()

        // `files` is the whole delivery - renditions, playlists and segments -
        // keyed by its path within the output. Written one at a time rather
        // than in parallel: a transcode already saturated the box, and a
        // hundred concurrent uploads to object storage is how the last step of
        // a ten-minute job fails on a rate limit.
        const prefix = `${VARIANT_PREFIX}/${payload.path}`
        for (const [name, bytes] of Object.entries(delivery.files))
          await adapter.write(`${prefix}/${name}`, bytes)

        log.debug(`[TranscodeStorageVideo] ${payload.path}: ${Object.keys(delivery.files).length} files`)

        return {
          files: Object.keys(delivery.files).length,
          renditions: delivery.derivatives.length,
        }
      }
      finally {
        await rm(staging, { force: true, recursive: true })
      }
    })
  },
})
