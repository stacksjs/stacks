import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

test('MCP serves the selected useApi routes, preserving CRUD, hidden fields, and user overrides', async () => {
  const project = await mkdtemp(join(tmpdir(), 'stacks-router-mcp-'))
  try {
    await mkdir(join(project, 'app/Models'), { recursive: true })
    // Supply the real default-on CSRF middleware without importing an installed
    // defaults package or its model catalogue into this disposable application.
    await mkdir(join(project, 'storage/framework/defaults/app'), { recursive: true })
    await symlink(resolve(import.meta.dir, '../../../defaults/app/Middleware'), join(project, 'storage/framework/defaults/app/Middleware'))
    const model = (name: string, uri: string) => ({
      name, table: uri, ownership: false,
      traits: { useTimestamps: false, useApi: { uri, prefix: 'v1', middleware: [] } },
      attributes: { title: { fillable: true }, secret: { fillable: true, hidden: true } },
    })
    await writeFile(join(project, 'app/Models/McpNote.ts'), `export default ${JSON.stringify(model('McpNote', 'notes'))}\n`)
    await writeFile(join(project, 'app/Models/Excluded.ts'), `export default ${JSON.stringify(model('Excluded', 'excluded'))}\n`)
    const config = join(project, 'bunfig.toml')
    await writeFile(config, 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', join(import.meta.dir, 'fixtures/router-mcp-use-api.ts')], {
      cwd: project,
      env: { ...process.env, STACKS_MODEL_APIS: 'McpNote', APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(project, 'mcp.sqlite'), DB_QUERY_LOGGING_ENABLED: 'false' },
      stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 25_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('router MCP useApi CRUD OK')
    }
    finally { clearTimeout(watchdog); child.kill() }
  }
  finally { await rm(project, { recursive: true, force: true }) }
}, 30_000)
