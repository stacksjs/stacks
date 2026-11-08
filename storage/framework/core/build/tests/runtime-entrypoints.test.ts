import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('published modules preserve Bun entrypoint guards and compile lazy dependencies', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-runtime-entrypoints-'))
  const fixture = join(root, 'package')
  mkdirSync(join(fixture, 'src'), { recursive: true })
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: '@fixture/runtime-entrypoints', type: 'module' }))
  writeFileSync(join(fixture, 'src/dependency.ts'), "export const value = 'embedded dependency'\n")
  writeFileSync(join(fixture, 'src/index.ts'), `
export const main: boolean = import.meta.main
export const native: boolean = typeof Bun !== 'undefined'
export function lazy(): string { return require('./dependency.ts').value }
if (import.meta.main) console.log('fixture command executed')
`)
  const builder = join(root, 'build.ts')
  writeFileSync(builder, `import { transpilePackage } from ${JSON.stringify(resolve(import.meta.dir, '../src/index.ts'))}\nawait transpilePackage({ dir: ${JSON.stringify(fixture)}, external: [] })\n`)
  async function run(args: string[]) {
    const child = Bun.spawn(args, { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [status, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(status, `${stdout}\n${stderr}`).toBe(0)
    return stdout.trim()
  }
  try {
    await run([process.execPath, '--no-env-file', builder])
    const module = join(fixture, 'dist/index.js')
    const consumer = join(root, 'consumer.ts')
    writeFileSync(consumer, `import {main,native,lazy} from ${JSON.stringify(module)}\nconsole.log(JSON.stringify({main,native,value:lazy()}))\n`)
    const expected = { main: false, native: true, value: 'embedded dependency' }
    expect(JSON.parse(await run([process.execPath, '--no-env-file', consumer, 'generate']))).toEqual(expected)
    expect(await run([process.execPath, '--no-env-file', module])).toBe('fixture command executed')
    const binary = join(root, process.platform === 'win32' ? 'consumer.exe' : 'consumer')
    await run([process.execPath, 'build', consumer, '--compile', '--minify', '--no-compile-autoload-dotenv', '--no-compile-autoload-bunfig', '--outfile', binary])
    expect(JSON.parse(await run([binary, 'generate']))).toEqual(expected)
  }
  finally { rmSync(root, { recursive: true }) }
}, 30000)
