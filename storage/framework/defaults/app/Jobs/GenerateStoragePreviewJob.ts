import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/queue'
import { Storage } from '@stacksjs/storage'
import { generateStoragePreview } from '../Actions/Dashboard/Content/file-preview'
import { databaseMetadataStore } from '../Actions/Dashboard/Content/file-metadata-store'

/**
 * Draw the small preview the file manager shows for an upload (stacksjs/stacks#308).
 *
 * Generated once and stored, not rendered on demand at the edge: a preview is a
 * derivative like the image variants and the video renditions, so it rides the
 * same `storage_item_tasks` row, the same `media` queue and the same
 * `.variants/<path>/` folder, and follows a rename or a delete the way they do.
 * The work itself - which kinds draw, which are skipped and why - is in
 * `file-preview.ts`, so it can be tested without a queue or a database.
 *
 * Unlike the other media jobs this one needs no staging directory: every
 * renderer works on bytes in memory, so a remote disk is read straight into the
 * decoder.
 */
interface GenerateStoragePreviewPayload {
  disk: string
  path: string
}

export default new Job({
  name: 'GenerateStoragePreview',
  description: 'Draw the file manager preview for an uploaded file (background)',
  queue: 'media',
  // Two tries: a decode that failed once on the same bytes will fail again, so
  // the retry is only for a disk read that hiccupped. A kind that cannot be
  // drawn here is recorded as skipped and never thrown, so it is not retried.
  tries: 2,
  backoff: [30, 120],

  async handle(payload: GenerateStoragePreviewPayload) {
    if (!payload?.disk || !payload?.path)
      throw new Error('[GenerateStoragePreview] payload.disk and payload.path are required')

    const preview = await generateStoragePreview(Storage.disk(payload.disk), databaseMetadataStore, payload.disk, payload.path)

    if (preview)
      log.debug(`[GenerateStoragePreview] ${payload.path}: ${preview.path} (${preview.bytes} bytes)`)

    return preview ?? { skipped: true }
  },
})
