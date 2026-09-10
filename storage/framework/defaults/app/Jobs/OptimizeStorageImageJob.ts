import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { image } from '@stacksjs/image'
import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/queue'
import { Storage } from '@stacksjs/storage'
import { runTask } from '../Actions/Dashboard/Content/file-metadata'
import { databaseMetadataStore } from '../Actions/Dashboard/Content/file-metadata-store'

/**
 * Build the responsive variants for an uploaded image (stacksjs/stacks#2578).
 *
 * Dispatched by the file manager's upload handler, not run inside it: encoding
 * four widths in three formats is seconds of CPU, and an upload handler that
 * waits for it is an upload handler that times out on a slow phone connection.
 *
 * Variants are written back to the SAME disk under `.variants/`, so they travel
 * with the original and a disk that is swapped out does not leave them behind.
 * The leading dot keeps them out of the file manager's listing, which skips
 * hidden components - a folder of thirty derivatives beside every photo would
 * make the browser useless.
 *
 * `ts-images` reads from the local filesystem, so a remote disk is staged
 * through a temp file. That is the whole reason for the download: an S3 object
 * has no path to hand a decoder.
 */
interface OptimizeStorageImagePayload {
  disk: string
  path: string
}

/** Where derivatives live, relative to the disk root. Hidden, so listings skip it. */
export const VARIANT_PREFIX = '.variants'

export default new Job({
  name: 'OptimizeStorageImage',
  description: 'Build responsive variants for an uploaded image (background)',
  queue: 'media',
  tries: 3,
  backoff: [10, 30, 90],

  async handle(payload: OptimizeStorageImagePayload) {
    if (!payload?.disk || !payload?.path)
      throw new Error('[OptimizeStorageImage] payload.disk and payload.path are required')

    return await runTask(databaseMetadataStore, payload.disk, payload.path, 'optimize', async () => {
      const adapter = Storage.disk(payload.disk)
      const staging = await mkdtemp(join(tmpdir(), 'stacks-optimize-'))

      try {
        const source = join(staging, basename(payload.path))
        await writeFile(source, await adapter.readToBuffer(payload.path))

        const manifest = await image(source)
          .preset('content')
          .storage(adapter, `${VARIANT_PREFIX}/${payload.path}`)
          .generate()

        log.debug(`[OptimizeStorageImage] ${payload.path}: ${manifest.variants.length} variants`)

        return {
          variants: manifest.variants.length,
          placeholder: manifest.placeholder,
        }
      }
      finally {
        // Always, including on the failure path: a staging directory left
        // behind on every retry is how a worker fills its disk overnight.
        await rm(staging, { force: true, recursive: true })
      }
    })
  },
})
