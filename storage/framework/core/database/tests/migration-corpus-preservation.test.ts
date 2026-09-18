import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'bun:test'

// The sweep resolves `database/migrations` and the SQLite file from the
// working directory, so the child runs in a throwaway app root. Nothing here
// touches this repository's own corpus or database.
test('the SQLite migration sweep never deletes a file from the corpus', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-corpus-'))
  try {
    const migrations = join(root, 'database/migrations')
    await mkdir(migrations, { recursive: true })
    const config = join(root, 'bunfig.toml')
    await writeFile(config, '# no preload\n')

    // Two generator-emitted files for the same table, the shape a corpus ends
    // up in after a regeneration lands on top of an older one.
    await writeFile(join(migrations, '0000000001-create-users-table.sql'), 'CREATE TABLE "users" (\n  "id" INTEGER PRIMARY KEY AUTOINCREMENT,\n  "email" TEXT\n);\n')
    await writeFile(join(migrations, '0000000044-create-users-table.sql'), 'CREATE TABLE "users" (\n  "id" INTEGER PRIMARY KEY AUTOINCREMENT,\n  "email" TEXT\n);\n')
    // Hand-authored, idempotent by design, and not derivable from any model:
    // the privacy migration from stacksjs/stacks#2234.
    await writeFile(join(migrations, '1754000000000-drop-geo-region-city.sql'), 'ALTER TABLE "page_views" DROP COLUMN "geo_region";\nALTER TABLE "page_views" DROP COLUMN "geo_city";\n')

    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/migration-corpus-preservation.ts`], {
      cwd: root,
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(root, 'app.sqlite'), STACKS_CORPUS_ROOT: root },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('corpus preserved OK')
  }
  finally { await rm(root, { recursive: true, force: true }) }
}, 30_000)
