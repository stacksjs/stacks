import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

test('importing prompts preserves native stdin payload and destruction', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-prompts-stdin-'))
  const config = join(directory, 'bunfig.toml')
  const prompts = fileURLToPath(new URL('../src/prompts.ts', import.meta.url))
  await writeFile(config, 'preload=[]\n[install]\nauto="disable"\n')
  const source = `
const input = process.stdin
const destroy = input.destroy
await import(${JSON.stringify(prompts)})
if (input.destroy !== destroy) throw new Error('prompts replaced native stdin.destroy')
let received = ''
await new Promise((resolve, reject) => {
  input.on('error', reject)
  input.on('data', chunk => {
    received += String(chunk)
    input.destroy()
  })
  input.once('close', resolve)
  input.resume()
})
if (received !== 'actual stdin payload' || !input.destroyed)
  throw new Error('native stdin payload or close was lost')
console.log('OK native stdin lifecycle after prompt import')
`
  try {
    const child = Bun.spawn([process.execPath, '--no-install', '--no-env-file', `--config=${config}`, '-e', source], {
      cwd: directory,
      env: { CI: '1' },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const timeout = setTimeout(() => child.kill(), 5000)
    try {
      child.stdin.write('actual stdin payload')
      child.stdin.end()
      const [status, output, error] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(status, error).toBe(0)
      expect(output).toBe('OK native stdin lifecycle after prompt import\n')
    }
    finally {
      clearTimeout(timeout)
    }
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 10000)
