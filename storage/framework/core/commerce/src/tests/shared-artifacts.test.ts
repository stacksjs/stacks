import { expect, test } from 'bun:test'
import { resolve } from 'node:path'

test('published narrow commerce entries retain runtime, declarations and pure browser imports', async () => {
  const directory = resolve(import.meta.dir, '../..')
  const built = Bun.spawnSync({ cmd: [process.execPath, 'build.ts'], cwd: directory, stdout: 'pipe', stderr: 'pipe' })
  expect(built.exitCode, new TextDecoder().decode(built.stderr)).toBe(0)
  for (const [entry, name] of [['inventory', 'restockedQuantity'], ['tax-input', 'parseSalesTaxSetup']]) {
    const path = resolve(directory, `dist/${entry}.js`)
    expect(await Bun.file(path).exists()).toBe(true)
    expect(await Bun.file(resolve(directory, `dist/${entry}.d.ts`)).exists()).toBe(true)
    expect(typeof (await import(path))[name!]).toBe('function')
    const browser = await Bun.build({ entrypoints: [path], target: 'browser', write: false })
    expect(browser.success).toBe(true)
  }
})
