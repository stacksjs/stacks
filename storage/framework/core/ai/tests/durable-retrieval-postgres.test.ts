import { SQL } from 'bun'
import { expect, test } from 'bun:test'
import { withDisposableDatabase } from '../../testing/src/disposable-database'
import { databaseExtensionStatements } from '../../database/src/model-extensions'
import { createDurableRetrievalStore } from '../src/durable-retrieval'

const vectorUrl = process.env.STACKS_TEST_PGVECTOR_URL

test.skipIf(!vectorUrl)('pgvector ranks only the materialized authorized current sources and survives client recreation and deletion', async () => {
  await withDisposableDatabase('postgres', async database => {
    const sql = new SQL(database.sqlOptions!)
    const query = async (statement: string, values: unknown[] = []) => await sql.unsafe(statement, values) as Record<string, unknown>[]
    const tables = { sources: 'knowledge_sources', indexes: 'knowledge_indexes', chunks: 'knowledge_chunks' }
    const store = createDurableRetrievalStore({ dialect: 'postgres', query, tables })
    try {
      expect(await store.available()).toBe(false)
      // The exact prerequisite emitted by native model-driven generation; no runtime adapter DDL.
      for (const statement of databaseExtensionStatements([{ databaseExtensions: ['vector'] }], 'postgres')) await query(statement)
      await query('CREATE TABLE knowledge_sources (id INTEGER PRIMARY KEY, workspace_id INTEGER, project_id INTEGER, language TEXT, publication TEXT, deleted_at BIGINT, audience TEXT, active_index_id INTEGER, current_revision INTEGER, source_key TEXT, permission_granted BOOLEAN)')
      await query('CREATE TABLE knowledge_indexes (id INTEGER PRIMARY KEY, source_id INTEGER, workspace_id INTEGER, project_id INTEGER, status TEXT, revision INTEGER, embedding_model TEXT, dimensions INTEGER)')
      await query('CREATE TABLE knowledge_chunks (id INTEGER PRIMARY KEY, source_id INTEGER, index_id INTEGER, workspace_id INTEGER, project_id INTEGER, revision INTEGER, content TEXT, embedding TEXT)')
      for (let id = 1; id <= 9; id++) {
        await query('INSERT INTO knowledge_sources VALUES ($1, $2, 1, $3, $4, $5, $6, $1, 2, $7, $8)', [id, id === 4 ? 2 : 1, id === 5 ? 'fr' : 'en', id === 6 ? 'draft' : 'published', id === 7 ? 100 : 0, id === 2 ? 'internal' : 'public', `article:${id}`, id !== 9])
        await query('INSERT INTO knowledge_indexes VALUES ($1, $1, 1, 1, $2, $3, $4, 2)', [id, 'active', id === 3 ? 1 : 2, 'fixture-embedding'])
        // Invalid embeddings outside the permitted relation prove distance evaluation cannot precede authorization.
        await query('INSERT INTO knowledge_chunks VALUES ($1, $1, $1, 1, 1, 2, $2, $3)', [id, `password reset ${id}`, id === 1 || id === 2 ? '[1,0]' : 'invalid-private-vector'])
      }
      const scope = { workspaceId: '1', projectId: '1', audience: 'public' as const, language: 'en', allowedSourceIds: ['1', '2', '3', '4', '5', '6', '7', '9'] }
      const request = { scope, query: 'credentials', vector: [1, 0], embeddingModel: 'fixture-embedding' }
      const hits = await store.search(request)
      expect(hits.map(hit => hit.sourceId)).toEqual(['1'])
      expect(hits[0]!.distance).toBe(0)
      expect((await store.search({ ...request, scope: { ...scope, audience: 'internal' } })).map(hit => hit.sourceId)).toEqual(['1', '2'])
      const fulltext = createDurableRetrievalStore({ dialect: 'postgres', query, tables, mode: 'lexical' })
      await query('UPDATE knowledge_chunks SET content = $1 WHERE id = 8', ['password password password'])
      const lexical = await fulltext.search({ scope: { ...scope, allowedSourceIds: ['1', '8'] }, query: 'password' })
      expect(lexical.map(hit => hit.sourceId)).toEqual(['8', '1'])
      expect(lexical.every(hit => hit.distance === null)).toBe(true)
      const recreated = createDurableRetrievalStore({ dialect: 'postgres', query, tables })
      expect(await recreated.search(request)).toEqual(hits)
      await query('UPDATE knowledge_sources SET current_revision = 3 WHERE id = 1')
      expect(await recreated.search(request)).toEqual([])
      await query('UPDATE knowledge_sources SET current_revision = 2, deleted_at = 100 WHERE id = 1')
      expect(await recreated.search(request)).toEqual([])
      await query('DELETE FROM knowledge_sources WHERE id = 1')
      expect(await recreated.search(request)).toEqual([])
    }
    finally { await sql.close() }
  }, { url: vectorUrl })
}, 30_000)
