/** Durable retrieval over application-owned, model-generated SQL tables. No runtime DDL. */
export type RetrievalQuery = (sql: string, values?: unknown[]) => Promise<Record<string, unknown>[]>
export interface RetrievalScope {
  workspaceId: string
  projectId: string
  audience: 'public' | 'internal'
  language: string
  /** Required intersection, authorized by the application before invoking retrieval. Empty denies all. */
  allowedSourceIds: readonly string[]
}
export interface RetrievalTables { sources: string, indexes: string, chunks: string }
export interface DurableRetrievalHit {
  chunkId: string
  sourceId: string
  sourceKey: string
  revision: number
  content: string
  distance: number | null
}
export interface DurableRetrievalRequest {
  scope: RetrievalScope
  query: string
  vector?: readonly number[]
  embeddingModel?: string
  limit?: number
}
export interface DurableRetrievalStore {
  mode: 'pgvector' | 'lexical'
  available: () => Promise<boolean>
  search: (request: DurableRetrievalRequest) => Promise<DurableRetrievalHit[]>
}
export class RetrievalCapabilityError extends Error {
  readonly code = 'retrieval_unavailable'
}
function identifier(value: string) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new TypeError('Invalid retrieval table identifier')
  return `"${value}"`
}
export function validateEmbedding(vector: unknown, dimensions?: number): number[] {
  if (!Array.isArray(vector) || !vector.length || vector.length > 16000 || (dimensions !== undefined && vector.length !== dimensions) || vector.some(value => typeof value !== 'number' || !Number.isFinite(value)) || !vector.some(value => value !== 0)) throw new TypeError('Embedding must be a finite nonzero vector with the configured dimensions')
  return vector as number[]
}
function scopeValues(scope: RetrievalScope) {
  if (!scope || !/^[1-9]\d*$/.test(scope.workspaceId) || !/^[1-9]\d*$/.test(scope.projectId) || !['public', 'internal'].includes(scope.audience) || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(scope.language) || !Array.isArray(scope.allowedSourceIds) || scope.allowedSourceIds.length > 10000 || scope.allowedSourceIds.some(id => !/^[1-9]\d*$/.test(id))) throw new TypeError('A complete authorized retrieval scope is required')
  return [...new Set(scope.allowedSourceIds)]
}
function hit(row: Record<string, unknown>): DurableRetrievalHit {
  return { chunkId: String(row.id), sourceId: String(row.source_id), sourceKey: String(row.source_key), revision: Number(row.revision), content: String(row.content), distance: row.distance === undefined || row.distance === null ? null : Number(row.distance) }
}
export function createDurableRetrievalStore(options: { dialect: 'sqlite' | 'postgres', query: RetrievalQuery, tables: RetrievalTables, mode?: 'pgvector' | 'lexical' }): DurableRetrievalStore {
  const sources = identifier(options.tables.sources), indexes = identifier(options.tables.indexes), chunks = identifier(options.tables.chunks)
  const mode = options.mode ?? (options.dialect === 'postgres' ? 'pgvector' : 'lexical')
  if (mode === 'pgvector' && options.dialect !== 'postgres') throw new RetrievalCapabilityError('pgvector retrieval requires PostgreSQL')
  const available = async () => mode === 'lexical' || (await options.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'")).length > 0
  return {
    mode,
    available,
    async search(request) {
      const ids = scopeValues(request.scope)
      if (!ids.length) return []
      const limit = request.limit ?? 8
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 || typeof request.query !== 'string' || request.query.length > 4000) throw new TypeError('Invalid retrieval query or limit')
      if (!await available()) throw new RetrievalCapabilityError('The model-declared vector extension has not been migrated')
      const values: unknown[] = []
      const param = (value: unknown) => { values.push(value); return options.dialect === 'postgres' ? `$${values.length}` : '?' }
      const scope = request.scope
      // All ownership, audience, publication, language, grants and active-revision checks occur inside
      // the materialized relation, before any vector distance is evaluated or ranked.
      const predicates = [
        `s.workspace_id = ${param(scope.workspaceId)}`, `s.project_id = ${param(scope.projectId)}`,
        `s.language = ${param(scope.language)}`, "s.publication = 'published'", 's.deleted_at = 0', 's.permission_granted = TRUE',
        scope.audience === 'public' ? "s.audience = 'public'" : "s.audience IN ('public', 'internal')",
        `s.id IN (${ids.map(id => param(id)).join(', ')})`,
        'i.id = s.active_index_id', "i.status = 'active'", 'i.revision = s.current_revision',
        'c.revision = s.current_revision', 'c.workspace_id = s.workspace_id', 'c.project_id = s.project_id',
        'i.workspace_id = s.workspace_id', 'i.project_id = s.project_id',
      ]
      let ordering = 'p.id ASC', distance = 'NULL AS distance'
      if (mode === 'pgvector') {
        const vector = validateEmbedding(request.vector)
        if (!request.embeddingModel?.trim() || request.embeddingModel.length > 200) throw new TypeError('Embedding model identity is required')
        predicates.push(`i.embedding_model = ${param(request.embeddingModel)}`, `i.dimensions = ${param(vector.length)}`, "c.embedding <> ''")
        distance = `(p.embedding::vector <=> ${param(JSON.stringify(vector))}::vector) AS distance`
        ordering = 'distance ASC, p.id ASC'
      }
      else if (options.dialect === 'postgres') {
        const query = param(request.query)
        predicates.push(`to_tsvector('simple', c.content) @@ plainto_tsquery('simple', ${query})`)
        ordering = `ts_rank_cd(to_tsvector('simple', p.content), plainto_tsquery('simple', ${query})) DESC, p.id ASC`
      }
      else {
        const terms = [...new Set(request.query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].slice(0, 12)
        for (const term of terms) predicates.push(`LOWER(c.content) LIKE ${param(`%${term}%`)}`)
      }
      const top = param(limit)
      const materialized = options.dialect === 'postgres' ? 'MATERIALIZED ' : ''
      const sql = `WITH permitted AS ${materialized}(SELECT c.id, c.source_id, c.revision, c.content, c.embedding, s.source_key FROM ${chunks} c JOIN ${sources} s ON s.id = c.source_id JOIN ${indexes} i ON i.id = c.index_id AND i.source_id = s.id WHERE ${predicates.join(' AND ')}) SELECT p.id, p.source_id, p.source_key, p.revision, p.content, ${distance} FROM permitted p ORDER BY ${ordering} LIMIT ${top}`
      return (await options.query(sql, values)).map(hit)
    },
  }
}
