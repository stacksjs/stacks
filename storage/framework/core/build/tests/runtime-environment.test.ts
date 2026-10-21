import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('transpiled packages read NODE_ENV from each consuming process', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-build-runtime-env-'))
  const helper = resolve(import.meta.dir, '../src/index.ts')
  const frameworkRoot = resolve(import.meta.dir, '../../../../..')
  const fixture = join(root, 'package')
  mkdirSync(join(fixture, 'src'), { recursive: true })
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: '@fixture/runtime-env', type: 'module' }))
  writeFileSync(join(fixture, 'src/index.ts'), `
export const mode: string | undefined = process.env.NODE_ENV
export function isProduction(): boolean { return process.env.NODE_ENV === 'production' }
`)
  const builder = join(root, 'build.ts')
  writeFileSync(builder, `import { transpilePackage } from ${JSON.stringify(helper)}
await transpilePackage({ dir: ${JSON.stringify(fixture)}, external: [] })
`)
  const entry = join(fixture, 'dist/index.js')
  const probe = `const mod = await import(${JSON.stringify(entry)}); console.log(JSON.stringify({ mode: mod.mode ?? null, production: mod.isProduction() }))`
  try {
    for (const buildMode of ['test', 'production']) {
      const build = Bun.spawn({
        cmd: [process.execPath, '--no-env-file', builder],
        cwd: frameworkRoot,
        env: { ...process.env, NODE_ENV: buildMode },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const [buildExit, , buildErrors] = await Promise.all([build.exited, new Response(build.stdout).text(), new Response(build.stderr).text()])
      expect({ exitCode: buildExit, stderr: buildExit === 0 ? '' : buildErrors }).toEqual({ exitCode: 0, stderr: '' })
      expect(existsSync(join(fixture, 'dist/index.d.ts'))).toBe(true)
      for (const runtimeMode of ['production', 'development', undefined]) {
        const env = { ...process.env }
        if (runtimeMode === undefined) delete env.NODE_ENV
        else env.NODE_ENV = runtimeMode
        const result = Bun.spawnSync({ cmd: [process.execPath, '--no-env-file', '-e', probe], cwd: root, env, stdout: 'pipe', stderr: 'pipe' })
        expect(new TextDecoder().decode(result.stderr)).toBe('')
        expect(result.exitCode).toBe(0)
        expect(JSON.parse(new TextDecoder().decode(result.stdout))).toEqual({ mode: runtimeMode ?? null, production: runtimeMode === 'production' })
      }
    }
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 30_000)
