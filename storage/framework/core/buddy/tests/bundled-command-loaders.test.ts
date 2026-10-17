import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Exercise the bundler boundary that standalone Buddy uses: a variable import
// omitted the command modules even though unbundled source dispatch worked.
test('a bundled lazy registry retains callable deployment and version commands', async () => {
  const runtime = resolve(import.meta.dir, '../../../../..', 'storage/framework/runtime')
  mkdirSync(runtime, { recursive: true })
  const root = mkdtempSync(join(runtime, 'buddy-bundled-commands-'))
  try {
    const loader = resolve(import.meta.dir, '../src/lazy-commands.ts')
    const cli = Bun.resolveSync('@stacksjs/cli', import.meta.dir)
    const entry = join(root, 'driver.ts')
    writeFileSync(entry, `import { loadCommand } from ${JSON.stringify(loader)}; import { cli } from ${JSON.stringify(cli)};
const buddy = cli('test');
if (!await loadCommand('deploy', buddy) || !await loadCommand('version', buddy)) throw new Error('Bundled command registrar missing');
if (!buddy.commands.some(command => command.name === 'deploy')) throw new Error('Deployment command missing');
console.log('BUNDLED_COMMANDS_OK');`)
    const output = join(root, 'bundle.js')
    const build = await Bun.build({ entrypoints: [entry], outdir: root, naming: 'bundle.js', target: 'bun' })
    expect(build.success).toBe(true)
    const child = Bun.spawn([process.execPath, output], { cwd: resolve(import.meta.dir, '../../../../..'), stdout: 'pipe', stderr: 'pipe' })
    const [status, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(status, stderr).toBe(0)
    expect(stdout).toContain('BUNDLED_COMMANDS_OK')
  }
  finally { rmSync(root, { recursive: true, force: true }) }
}, 30_000)
