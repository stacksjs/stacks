import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/queue'
import { useSearchEngine } from '@stacksjs/search-engine'

/**
 * Background search-index sync job (stacksjs/stacks#1891).
 *
 * Models declaring `traits.useSearch: { queueable: true }` dispatch
 * to this job from their `afterCreate` / `afterUpdate` / `afterDelete`
 * hooks instead of calling the search-engine driver inline. That
 * keeps the request path off the network round-trip when the search
 * backend is on a different host — slow upserts or transient
 * Meilisearch failures don't block the user write.
 *
 * Payload shape (dispatched by `define-model.ts:buildSearchHooks`):
 *   - `{ op: 'upsert', index, doc }` — create or update a document
 *   - `{ op: 'delete', index, id }`  — remove a document by id
 *
 * Failures throw so the queue counts them as failed attempts and
 * the configured backoff retries. With `tries: 5` and the default
 * backoff, a five-minute Meilisearch outage doesn't lose writes.
 */
interface SyncSearchIndexPayload {
  index: string
  op: 'upsert' | 'delete'
  doc?: Record<string, unknown>
  id?: number
}

export default new Job({
  name: 'SyncSearchIndex',
  description: 'Sync a model write to the search engine (background)',
  queue: 'search',
  tries: 5,
  backoff: [5, 15, 30, 60, 120],

  async handle(payload: SyncSearchIndexPayload) {
    if (!payload?.index || !payload?.op) {
      throw new Error('[SyncSearchIndex] payload.index and payload.op are required')
    }

    const engine = useSearchEngine()

    if (payload.op === 'upsert') {
      if (!payload.doc) {
        throw new Error('[SyncSearchIndex] upsert requires payload.doc')
      }
      await engine.addDocument(payload.index, payload.doc)
      log.debug(`[SyncSearchIndex] upserted into ${payload.index}`)
      return { ok: true, op: 'upsert', index: payload.index }
    }

    if (payload.op === 'delete') {
      if (payload.id == null) {
        throw new Error('[SyncSearchIndex] delete requires payload.id')
      }
      await engine.deleteDocument(payload.index, Number(payload.id))
      log.debug(`[SyncSearchIndex] deleted ${payload.id} from ${payload.index}`)
      return { ok: true, op: 'delete', index: payload.index, id: payload.id }
    }

    throw new Error(`[SyncSearchIndex] unknown op '${(payload as { op?: string }).op}'`)
  },
})
