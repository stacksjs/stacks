import type { ConfiguredAIOptions } from '@stacksjs/ai'
import { buildMessageWithImages, createAIClient } from '@stacksjs/ai'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/queue'
import { Storage } from '@stacksjs/storage'
import { runTask, setTags } from '../Actions/Dashboard/Content/file-metadata'
import { databaseMetadataStore } from '../Actions/Dashboard/Content/file-metadata-store'

/**
 * Ask a vision model what is in an uploaded image, and record the answer as
 * tags (stacksjs/stacks#2578).
 *
 * A background job because it is a network round trip to a third party, and one
 * that can take ten seconds under load. It also costs money per call, which is
 * the reason for the guards below: this runs once per upload, and a retry storm
 * against a misconfigured key would be an invoice rather than an outage.
 *
 * Tags are MERGED with whatever a person already put on the file rather than
 * replacing them. A human tag is a decision and a model's tag is a suggestion,
 * and having the suggestion overwrite the decision is the version of this
 * feature nobody wants twice.
 */
interface TagStorageMediaPayload {
  disk: string
  path: string
  /**
   * How many tags to ask for. Bounded low on purpose: a model asked for twenty
   * will produce twenty, and the last fifteen are noise that make the tag list
   * less useful rather than more.
   */
  limit?: number
}

/** What the model is asked to return, so the answer is parsed rather than scraped. */
const TAG_SCHEMA = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['tags'],
  additionalProperties: false,
} as const

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 12

/** Beyond this a base64 image is a request body the provider will refuse anyway. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export default new Job({
  name: 'TagStorageMedia',
  description: 'Ask a vision model to tag an uploaded image (background)',
  queue: 'media',
  // Two, not three: each attempt is a paid call, and the failures worth
  // retrying here are transient network ones rather than a rejected image.
  tries: 2,
  backoff: [30, 120],

  async handle(payload: TagStorageMediaPayload) {
    if (!payload?.disk || !payload?.path)
      throw new Error('[TagStorageMedia] payload.disk and payload.path are required')

    const limit = Math.max(1, Math.min(payload.limit ?? DEFAULT_LIMIT, MAX_LIMIT))

    return await runTask(databaseMetadataStore, payload.disk, payload.path, 'tag', async () => {
      const adapter = Storage.disk(payload.disk)
      const bytes = await adapter.readToBuffer(payload.path)

      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        throw new Error(
          `[TagStorageMedia] ${payload.path} is ${bytes.byteLength} bytes; the vision path is capped at ${MAX_IMAGE_BYTES}. `
          + 'Tag a generated variant instead of the original.',
        )
      }

      const mediaType = await adapter.mimeType(payload.path)
      if (!mediaType.startsWith('image/'))
        throw new Error(`[TagStorageMedia] ${payload.path} is ${mediaType}, which is not something a vision model reads`)

      const aiConfig = (config.ai || {}) as ConfiguredAIOptions
      const client = createAIClient(aiConfig)

      // Sent as base64 rather than a URL: the file may be on a private disk,
      // and handing a provider a signed URL would mean minting one that
      // outlives the call.
      const content = buildMessageWithImages(
        `Give up to ${limit} short lowercase tags describing what is in this image. `
        + 'Prefer concrete nouns over judgements. Return only the JSON object.',
        [{ dataBase64: bytes.toString('base64'), mediaType }],
      )

      const { data } = await client.generateObject<{ tags: string[] }>(
        [{ role: 'user', content }],
        TAG_SCHEMA as unknown as Record<string, unknown>,
        { maxTokens: 300, temperature: 0 },
      )

      const suggested = Array.isArray(data?.tags) ? data.tags.slice(0, limit) : []
      if (suggested.length === 0)
        return { tags: [] }

      // Merged, not replaced. `setTags` normalizes and deduplicates, so a model
      // suggesting a tag somebody already applied is a no-op rather than a
      // duplicate.
      const existing = (await databaseMetadataStore.under(payload.disk, payload.path)).get(payload.path)
      const record = await setTags(
        databaseMetadataStore,
        payload.disk,
        payload.path,
        [...(existing?.tags ?? []), ...suggested],
      )

      log.debug(`[TagStorageMedia] ${payload.path}: ${suggested.length} suggested, ${record.tags.length} total`)

      return { tags: record.tags }
    })
  },
})
