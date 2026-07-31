import { describe, expect, it } from 'bun:test'
import { basename, relative } from 'node:path'

const actionRoot = new URL('../../storage/framework/defaults/app/Actions/Dashboard/', import.meta.url).pathname

describe('dashboard action contract', () => {
  it('does not ship empty Action handlers', async () => {
    const emptyActions: string[] = []
    const glob = new Bun.Glob('**/*.ts')

    for await (const file of glob.scan({ absolute: true, cwd: actionRoot, onlyFiles: true })) {
      if (basename(file).endsWith('.test.ts'))
        continue

      const source = await Bun.file(file).text()
      if (!source.includes('new Action('))
        continue

      const emptyHandle = /async\s+handle\s*\([^)]*\)\s*\{\s*(?:(?:\/\/[^\n]*\n)|(?:\/\*[\s\S]*?\*\/\s*))*\}/
      if (emptyHandle.test(source))
        emptyActions.push(relative(actionRoot, file))
    }

    expect(emptyActions).toEqual([])
  })
})
