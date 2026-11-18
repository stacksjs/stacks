import { expect, test } from 'bun:test'
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('a copied native Action imports and streams without loading app config', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-portable-action-'))
  try {
    const entry = join(import.meta.dir, 'fixtures/portable-action.ts')
    const built = await Bun.build({
      entrypoints: [entry],
      target: 'bun',
      format: 'esm',
      splitting: false,
      external: ['@swc/wasm'],
      write: false,
    })
    expect(built.success, built.logs.map(String).join('\n')).toBe(true)
    await writeFile(join(directory, 'probe.mjs'), await built.outputs[0]!.text())
    await writeFile(join(directory, 'package.json'), '{"type":"module","private":true}')
    const bunfig = join(directory, 'bunfig.toml')
    await writeFile(bunfig, 'preload=[]\n[install]\nauto="disable"\n')
    await copyFile(join(import.meta.dir, 'fixtures/portable-action-check.ts'), join(directory, 'check.ts'))
    const child = Bun.spawn([process.execPath, '--no-install', `--config=${bunfig}`, '--no-env-file', join(directory, 'check.ts'), entry], {
      cwd: directory,
      env: { PATH: process.env.PATH, APP_ENV: 'test', NODE_ENV: 'test' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const timeout = setTimeout(() => child.kill('SIGKILL'), 10_000)
    try {
      const [code, stdout, stderr] = await Promise.all([
        child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
      ])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stderr).toBe('')
      expect(stdout).toContain('PASS portable Action without app config')
    }
    finally {
      clearTimeout(timeout)
      if (child.exitCode === null)
        child.kill('SIGKILL')
      await child.exited
    }
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 20_000)
