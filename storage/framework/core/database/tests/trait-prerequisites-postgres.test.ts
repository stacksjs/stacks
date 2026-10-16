import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SQL } from 'bun'

test.skipIf(!process.env.STACKS_TEST_POSTGRES_URL)('fresh model migrations preserve native trait foreign keys and application-owned tables', async () => {
  const url = new URL(process.env.STACKS_TEST_POSTGRES_URL!)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Requires a local disposable PostgreSQL server')
  const database = `stacks_trait_prerequisites_${crypto.randomUUID().replaceAll('-', '')}`
  const admin = new SQL(url.href, { database: decodeURIComponent(url.pathname.slice(1)) })
  const root = await mkdtemp(join(tmpdir(), 'stacks-trait-prerequisites-'))
  let created = false
  try {
    await admin.unsafe(`CREATE DATABASE "${database}"`)
    created = true
    await writeFile(join(root, 'bunfig.toml'), 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${join(root, 'bunfig.toml')}`, '--no-env-file', join(import.meta.dir, 'fixtures/trait-prerequisites-postgres.ts')], {
      cwd: root,
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'postgres', DB_DATABASE: database, PGDATABASE: database, DB_HOST: url.hostname, DB_PORT: url.port || '5432', DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password) },
      stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(50_000),
    })
    const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, out + err).toBe(0)
    expect(out).toContain('native trait prerequisites OK')
  }
  finally {
    if (created) await admin.unsafe(`DROP DATABASE "${database}" WITH (FORCE)`)
    await admin.close()
    await rm(root, { recursive: true, force: true })
  }
}, 60_000)
