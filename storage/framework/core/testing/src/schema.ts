/** Apply transaction-compatible schema statements to a configured test database.
 * Use with a disposable database in an isolated process, after initializing its
 * database config. This does not discover models, disable constraints, migrate
 * production data or change durability settings.
 */
export async function applyTestSchema(statements: readonly string[]): Promise<void> {
  if (!statements.length) return
  const { db, getDatabaseDialect } = await import('@stacksjs/database/runtime')
  const dialect = getDatabaseDialect()
  if (dialect !== 'sqlite' && dialect !== 'postgres') throw new Error('Atomic test schema setup requires SQLite or PostgreSQL')
  await db.transaction(async tx => {
    if (dialect === 'postgres') {
      // A single protocol batch avoids one round trip per generated statement.
      // Put each separator on its own line so trailing SQL comments cannot
      // swallow it. Do not split SQL strings or function bodies ourselves.
      await tx.unsafe(statements.map(statement => `${statement}\n;`).join('\n'))
    }
    else {
      // SQLite's statement API runs one statement at a time. The surrounding
      // transaction still makes the complete setup atomic and durable.
      for (const statement of statements) await tx.unsafe(statement)
    }
  })
}
