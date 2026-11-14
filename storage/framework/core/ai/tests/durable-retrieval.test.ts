import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { createDurableRetrievalStore, validateEmbedding } from '../src/durable-retrieval'
import { createConfiguredEmbeddingClient } from '../src/embedding-client'

const scope = { workspaceId: '1', projectId: '1', audience: 'public' as const, language: 'en', allowedSourceIds: ['1', '2', '3', '4', '5', '6', '7'] }
const tables = { sources: 'knowledge_sources', indexes: 'knowledge_indexes', chunks: 'knowledge_chunks' }
function fixture() {
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE knowledge_sources (id INTEGER PRIMARY KEY, workspace_id INTEGER, project_id INTEGER, language TEXT, publication TEXT, deleted_at INTEGER, audience TEXT, active_index_id INTEGER, current_revision INTEGER, source_key TEXT, permission_granted INTEGER);
    CREATE TABLE knowledge_indexes (id INTEGER PRIMARY KEY, source_id INTEGER, workspace_id INTEGER, project_id INTEGER, status TEXT, revision INTEGER, embedding_model TEXT, dimensions INTEGER);
    CREATE TABLE knowledge_chunks (id INTEGER PRIMARY KEY, source_id INTEGER, index_id INTEGER, workspace_id INTEGER, project_id INTEGER, revision INTEGER, content TEXT, embedding TEXT);`)
  for (let id = 1; id <= 8; id++) {
    db.run('INSERT INTO knowledge_sources VALUES (?, ?, 1, ?, ?, ?, ?, ?, 2, ?, 1)', [id, id === 4 ? 2 : 1, id === 5 ? 'fr' : 'en', id === 6 ? 'draft' : 'published', id === 7 ? 100 : 0, id === 2 ? 'internal' : 'public', id, `article:${id}`])
    db.run('INSERT INTO knowledge_indexes VALUES (?, ?, 1, 1, ?, ?, ?, 2)', [id, id, 'active', id === 3 ? 1 : 2, 'test'])
    db.run('INSERT INTO knowledge_chunks VALUES (?, ?, ?, 1, 1, 2, ?, ?)', [id, id, id, `password support ${id}`, '[1,0]'])
  }
  return db
}
describe('durable scoped retrieval', () => {
  test('SQLite filters ownership, audience, language, publication, deletion, source grants and current revision in SQL', async () => {
    const db = fixture()
    try {
      const query = async (sql: string, values: unknown[] = []) => db.query(sql).all(...values as any[]) as Record<string, unknown>[]
      const store = createDurableRetrievalStore({ dialect: 'sqlite', query, tables })
      expect((await store.search({ scope, query: 'password' })).map(hit => hit.sourceId)).toEqual(['1'])
      expect((await store.search({ scope: { ...scope, audience: 'internal' }, query: 'password' })).map(hit => hit.sourceId)).toEqual(['1', '2'])
      expect(await store.search({ scope: { ...scope, allowedSourceIds: [] }, query: 'password' })).toEqual([])
      db.run('UPDATE knowledge_sources SET current_revision = 3 WHERE id = 1')
      expect(await store.search({ scope, query: 'password' })).toEqual([])
    }
    finally { db.close() }
  })
  test('malformed scopes, table names, zero vectors and inconsistent dimensions fail closed', async () => {
    const query = async () => []
    expect(() => createDurableRetrievalStore({ dialect: 'sqlite', query, tables: { ...tables, sources: 'sources; DROP TABLE users' } })).toThrow('identifier')
    expect(() => validateEmbedding([0, 0])).toThrow('nonzero')
    expect(() => validateEmbedding([1, NaN])).toThrow('finite')
    expect(() => validateEmbedding([1, 0], 3)).toThrow('dimensions')
    const store = createDurableRetrievalStore({ dialect: 'sqlite', query, tables })
    await expect(store.search({ scope: { ...scope, allowedSourceIds: undefined as never }, query: 'test' })).rejects.toThrow('scope')
  })
  test('configured embedding client makes provider-shaped HTTP requests and orders the returned batch', async () => {
    const seen: unknown[] = []
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(request) {
      expect(new URL(request.url).pathname).toBe('/v1/embeddings')
      expect(request.headers.get('authorization')).toBe('Bearer fixture-key')
      seen.push(await request.json())
      return Response.json({ data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] })
    } })
    try {
      const client = createConfiguredEmbeddingClient({ default: 'openai', drivers: { openai: { apiKey: 'fixture-key', baseUrl: `http://127.0.0.1:${server.port}/v1` } } }, { model: 'fixture-embedding', dimensions: 2 })
      expect(await client.embed(['password', 'shipping'])).toEqual([[1, 0], [0, 1]])
      expect(seen).toEqual([{ model: 'fixture-embedding', input: ['password', 'shipping'], dimensions: 2 }])
    }
    finally { await server.stop(true) }
  })
  test('chat-only providers do not silently send knowledge to an unrelated embedding service', () => {
    expect(() => createConfiguredEmbeddingClient({ default: 'anthropic' })).toThrow('not implemented')
  })
})
