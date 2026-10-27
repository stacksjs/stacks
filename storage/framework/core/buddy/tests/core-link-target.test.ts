import { expect, it } from 'bun:test'
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

it('links an explicitly targeted app without changing the host install or either manifest', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'stacks-core-link-target-'))
  const host = join(fixture, 'host')
  const app = join(host, 'storage/framework/runtime/sites/app')
  const framework = join(fixture, 'framework')
  const source = join(framework, 'storage/framework/core/path')
  for (const directory of [join(host, 'node_modules/@stacksjs/path'), join(app, 'node_modules/@stacksjs/path'), join(source, 'dist')])
    mkdirSync(directory, { recursive: true })
  const manifest = JSON.stringify({ name: 'attached-app', stacks: { type: 'native' } })
  writeFileSync(join(app, 'package.json'), manifest)
  writeFileSync(join(host, 'package.json'), '{"name":"host"}')
  writeFileSync(join(source, 'package.json'), '{"name":"@stacksjs/path"}')
  writeFileSync(join(source, 'dist/index.js'), 'export const source = true')
  writeFileSync(join(host, 'node_modules/@stacksjs/path/host-marker'), 'untouched')
  try {
    const program = `
      const { cli } = await import(${JSON.stringify(Bun.resolveSync('@stacksjs/cli', import.meta.dir))})
      const { link } = await import(${JSON.stringify(new URL('../src/commands/link.ts', import.meta.url).href)})
      const buddy = cli('buddy')
      link(buddy)
      await buddy.parse()
    `
    const entry = join(fixture, 'link.ts')
    writeFileSync(entry, program)
    const result = Bun.spawnSync([process.execPath, entry, 'link:core', 'path', '--path', framework, '--cwd', app], { cwd: host, stdout: 'pipe', stderr: 'pipe', timeout: 15_000 })
    expect(result.exitCode, `${result.stdout.toString()}\n${result.stderr.toString()}`).toBe(0)
    expect(lstatSync(join(app, 'node_modules/@stacksjs/path')).isSymbolicLink()).toBe(true)
    expect(realpathSync(join(app, 'node_modules/@stacksjs/path'))).toBe(realpathSync(source))
    expect(readFileSync(join(host, 'node_modules/@stacksjs/path/host-marker'), 'utf8')).toBe('untouched')
    expect(readFileSync(join(app, 'package.json'), 'utf8')).toBe(manifest)
    expect(JSON.parse(readFileSync(join(app, 'storage/framework/runtime/linked-core.json'), 'utf8')).packages).toEqual(['@stacksjs/path'])
  }
  finally { rmSync(fixture, { recursive: true, force: true }) }
})
