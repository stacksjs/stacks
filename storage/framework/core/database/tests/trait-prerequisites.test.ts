import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { traitTablePrerequisiteSql } from '../src/trait-tables'
import { sqlHelpers } from '../src/sql-helpers'

test('model foreign keys can reference native conversations on a fresh database', () => {
  const corpus = `CREATE TABLE preferences (id INTEGER PRIMARY KEY, conversation_id VARCHAR(64) REFERENCES "chat_conversations"(id) ON DELETE CASCADE)`
  const db = new Database(':memory:')
  db.run('PRAGMA foreign_keys=ON')
  try {
    for (const statement of traitTablePrerequisiteSql(corpus, sqlHelpers('sqlite'))) db.run(statement)
    db.run(corpus)
    db.run("INSERT INTO chat_conversations VALUES ('conversation', 'scope', 'users', 1, 2, '2026-10-16')")
    db.run("INSERT INTO preferences VALUES (1, 'conversation')")
    expect(() => db.run("INSERT INTO preferences VALUES (2, 'missing')")).toThrow()
    db.run("DELETE FROM chat_conversations WHERE id='conversation'")
    expect(db.query('SELECT * FROM preferences').all()).toHaveLength(0)
  }
  finally { db.close() }
})

test('message prerequisites include their native conversation parent in order', () => {
  const plan = traitTablePrerequisiteSql('CREATE TABLE evidence (message_id BIGINT REFERENCES `chat_messages`(id))', sqlHelpers('postgres'))
  expect(plan).toHaveLength(2)
  expect(plan[0]).toContain('CREATE TABLE IF NOT EXISTS chat_conversations')
  expect(plan[1]).toContain('CREATE TABLE IF NOT EXISTS chat_messages')
})

test('application-owned trait tables keep their declared shape', () => {
  const corpus = `CREATE TABLE chat_conversations (id VARCHAR(64) PRIMARY KEY, custom_column TEXT);
    CREATE TABLE preferences (conversation_id VARCHAR(64) REFERENCES chat_conversations(id))`
  expect(traitTablePrerequisiteSql(corpus, sqlHelpers('postgres'))).toEqual([])
})

test('comments and string contents do not introduce native dependencies', () => {
  const corpus = `-- REFERENCES chat_conversations(id)
    CREATE TABLE notes (body TEXT DEFAULT 'REFERENCES chat_messages(id)')`
  expect(traitTablePrerequisiteSql(corpus, sqlHelpers('postgres'))).toEqual([])
})
