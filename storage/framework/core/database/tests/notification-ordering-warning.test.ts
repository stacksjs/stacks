import { expect, test } from 'bun:test'
import { join } from 'node:path'

/**
 * The ordering warning, end to end (stacksjs/stacks#2896).
 *
 * `preflightShapeWarning` decides and is unit-tested beside the classifier it
 * reads from. What a unit test cannot see is whether the decision is consulted
 * in the right branch: the warning belongs where the shape comparison finds no
 * table, because that is the moment the framework's create becomes the table
 * the corpus will fail to widen. Put it anywhere else and it fires on the
 * wrong databases, or never.
 *
 * So this runs the real guarantee twice against two equally empty sqlite
 * databases, for a table the corpus creates after reading it and for a table
 * nobody else declared, and counts. One occurrence means it reached the
 * operator in the first case and stayed quiet in the second.
 */
test('warns once about a corpus-owned table, and not about a framework-owned one', async () => {
  const child = Bun.spawn([process.execPath, join(import.meta.dir, 'fixtures/notification-ordering-warning.ts')], {
    cwd: join(import.meta.dir, '..'),
    // DB_CONNECTION is explicit because the guarantee reads the driver from the
    // environment rather than the config it was handed, and this checkout's
    // .env says postgres: the preload refills it even with --no-env-file, and
    // postgres DDL against a sqlite file fails with `near "AT": syntax error`.
    env: { ...process.env, APP_ENV: 'production', DB_CONNECTION: 'sqlite', DB_QUERY_LOGGING_ENABLED: 'false' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  const output = `${stdout}\n${stderr}`

  expect(exitCode, output).toBe(0)
  expect(stdout).toContain('notification-ordering-warning-ok')
  expect(output.split('is created by your own migrations').length - 1, output).toBe(1)
  expect(output).toContain('Move whatever reads "notification_deliveries" after the migration that creates it')
})
