import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateRuntimeExports } from '../src/index'

test.each([
  { name: 'invalid emitted JavaScript', code: 'export const { class = "input" } = {};', rejects: true },
  { name: 'a browser environment requirement', code: 'export const node = document.createElement("div")', rejects: false },
  { name: 'valid emitted JavaScript', code: 'export const value = 1', rejects: false },
])('runtime export check: $name', async ({ code, rejects }) => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-runtime-exports-'))
  try {
    await mkdir(join(root, 'dist'))
    await writeFile(join(root, 'package.json'), '{"type":"module"}')
    await writeFile(join(root, 'dist/index.js'), code)
    if (rejects)
      await expect(validateRuntimeExports(root)).rejects.toThrow('cannot be imported')
    else
      await expect(validateRuntimeExports(root)).resolves.toBeUndefined()
  }
  finally { await rm(root, { recursive: true, force: true }) }
})
