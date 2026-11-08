import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('compiled native validation carries its message provider without node_modules', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'stacks-compiled-validation-'))
  const entry = join(fixture, 'entry.ts')
  const binary = join(fixture, process.platform === 'win32' ? 'validation.exe' : 'validation')
  writeFileSync(entry, `import { schema } from ${JSON.stringify(join(import.meta.dir, '../src/runtime.ts'))}\nimport { validateRule } from ${JSON.stringify(join(import.meta.dir, '../src/messages.ts'))}\nconst result = validateRule(schema.string().max(2), 'oversized fixture')\nif (result.valid) throw new Error('Invalid input was accepted')\nconsole.log('compiled validation verified')\n`)
  try {
    const build = Bun.spawn([process.execPath, 'build', entry, '--compile', '--minify', '--no-compile-autoload-bunfig', '--no-compile-autoload-dotenv', '--outfile', binary], { cwd: fixture, stdout: 'pipe', stderr: 'pipe' })
    const [built, buildOut, buildErr] = await Promise.all([build.exited, new Response(build.stdout).text(), new Response(build.stderr).text()])
    expect(built, `${buildOut}\n${buildErr}`).toBe(0)
    const run = Bun.spawn([binary], { cwd: fixture, stdout: 'pipe', stderr: 'pipe' })
    const [status, stdout, stderr] = await Promise.all([run.exited, new Response(run.stdout).text(), new Response(run.stderr).text()])
    expect(status, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('compiled validation verified')
  }
  finally { rmSync(fixture, { recursive: true }) }
}, 30000)
