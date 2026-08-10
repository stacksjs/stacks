/**
 * The `oauth_*` and `password_resets` schema for auth tests.
 *
 * These tests used to carry their own `CREATE TABLE` copies of that schema.
 * That made the fixtures a third definition of it, alongside the migrator in
 * `@stacksjs/database` and the columns `tokens.ts` actually writes, and the
 * three drifted the moment anyone added a column: `user_agent` and
 * `ip_address` landed in `auth-tables.ts` and in the INSERT in `tokens.ts`
 * for the session list in stacksjs/stacks#2286, the fixtures kept their
 * older shape, and eleven tests started failing on `table
 * oauth_access_tokens has no column named user_agent` for a feature none of
 * them exercise.
 *
 * So they call the migrator instead. It is the same code path `buddy
 * migrate` runs, it is `CREATE TABLE IF NOT EXISTS` throughout plus
 * idempotent ALTERs, and it seeds the personal access client the token
 * helpers need. A column added to the real schema now reaches these tests
 * for free.
 *
 * `users` and `sessions` stay with each test. The auth migrator does not own
 * them (they come from model migrations), and the tests that care about an
 * un-migrated `users` need to shape it themselves.
 *
 * Import this only AFTER the test file has set `DB_CONNECTION` /
 * `DB_DATABASE_PATH` and awaited `initializeDbConfig`, the same ordering
 * constraint every one of these files already observes for
 * `@stacksjs/database` itself.
 */
export async function ensureFrameworkAuthTables(): Promise<void> {
  const { migrateAuthTables } = await import('@stacksjs/database')

  const result = await migrateAuthTables()
  if (!result.success)
    throw new Error(`auth tables failed to migrate for this test: ${result.error}`)
}
