import { describe, expect, it } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { publishables } from './promote-latest'
import { inBatches, publishLayers, publishOne } from './publish-layers'

const root = new URL('../../', import.meta.url).pathname
const pkg = (name: string, dependencies: string[] = []) => ({ name, dir: `storage/framework/core/${name}`, dependencies })
const names = (layers: ReturnType<typeof publishLayers>) => layers.map(layer => layer.map(item => item.name))

describe('publish layers', () => {
  it('puts each package after everything it depends on, and siblings together', () => {
    expect(names(publishLayers([
      pkg('cli', ['strings', 'path']),
      pkg('strings'),
      pkg('buddy', ['cli', 'actions']),
      pkg('path'),
      pkg('actions', ['cli', 'left-pad']),
    ]))).toEqual([['path', 'strings'], ['cli'], ['actions'], ['buddy']])
  })

  it('refuses a cycle, which no order could publish', () => {
    expect(() => publishLayers([pkg('a', ['b']), pkg('b', ['a'])])).toThrow('dependency cycle: a -> b -> a')
  })

  it('covers every package the promotion step promotes, and layers the real framework', async () => {
    const found = await publishables(root)
    const packages = await Promise.all(found.map(async item => ({ name: item.name, dir: item.dir, dependencies: Object.keys((await Bun.file(`${root}${item.dir}/package.json`).json()).dependencies ?? {}) })))
    const layers = publishLayers(packages)
    expect(layers.flat().map(item => item.name).sort()).toEqual(found.map(item => item.name).sort())
    // Far fewer rounds than packages: the point of layering.
    expect(layers.length).toBeLessThan(packages.length / 3)
  })

  it('is what the release workflow publishes with', () => {
    const workflow = readFileSync(`${root}.github/workflows/release.yml`, 'utf8')
    expect(workflow).toContain('bun .github/scripts/publish-layers.ts --npm --access public --ignore-scripts --tag staging --no-readback')
  })
})

describe('publishing one package', () => {
  it('gives each parallel publish its own temporary directory, and removes it', async () => {
    // pantry staged every tarball in one $TMPDIR/pantry-staging, so parallel
    // publishes deleted each other's files (v0.75.235).
    const fake = mkdtempSync(join(tmpdir(), 'publish-layers-test-'))
    try {
      mkdirSync(join(fake, '.github/scripts'), { recursive: true })
      const script = join(fake, '.github/scripts/publish-npm.sh')
      writeFileSync(script, '#!/bin/sh\ntest -d "$TMPDIR" && echo "$TMPDIR" >> "$TRACE"\n')
      chmodSync(script, 0o755)
      const trace = join(fake, 'trace')
      process.env.TRACE = trace
      const results = await Promise.all(['a', 'b', 'c'].map(name => publishOne(fake, [], { name, dir: name, dependencies: [] })))
      expect(results.every(result => result.ok)).toBe(true)
      const dirs = readFileSync(trace, 'utf8').trim().split('\n')
      expect(new Set(dirs).size).toBe(3)
      expect(dirs.some(dir => existsSync(dir))).toBe(false)
    }
    finally {
      delete process.env.TRACE
      rmSync(fake, { recursive: true, force: true })
    }
  })
})

describe('in batches', () => {
  it('runs no more than the limit at once and keeps the results in order', async () => {
    let running = 0
    let most = 0
    const results = await inBatches([5, 1, 4, 2, 3], 2, async (ms) => {
      running++
      most = Math.max(most, running)
      await Bun.sleep(ms)
      running--
      return ms * 10
    })
    expect(most).toBe(2)
    expect(results).toEqual([50, 10, 40, 20, 30])
  })
})
