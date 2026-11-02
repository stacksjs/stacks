import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'
import { findChrome } from '@stacksjs/testing/browser'
import { average, median, min, max } from '../src/math'
import { sample } from '../src/helpers'
import { meanBy } from '../src/transform'
import { summarizeSeries } from '../src/series'

test('finite aggregates avoid overflow and large arrays avoid function argument limits', () => {
  expect(average([1e308, 1e308])).toBe(1e308)
  let selections = 0
  expect(meanBy([1e308, 1e308], value => { selections++; return value })).toBe(1e308)
  expect(selections).toBe(2)
  expect(summarizeSeries([{date:'2026-01-01',value:1e308},{date:'2026-01-02',value:1e308}]).average).toBe(1e308)
  expect(average([-1e308, -1e308])).toBe(-1e308)
  expect(average([1e308, 1e308, -1e308, -1e308])).toBe(0)
  expect(median([1e308, 1e308])).toBe(1e308)
  expect(median([-1e308, -1e308])).toBe(-1e308)
  expect(median([-1e308, 1e308])).toBe(0)
  const values = Array.from({ length: 250_000 }, (_, index) => index)
  expect(min(values)).toBe(0); expect(max(values)).toBe(249999)
  expect(() => min([])).toThrow(); expect(() => max([])).toThrow()
  for (const select of [min, max]) {
    expect(select([NaN, 1])).toBeNaN()
    expect(select(Array<number>(1))).toBeNaN()
  }
  expect(Object.is(min([0, -0]), -0)).toBe(true)
  expect(Object.is(max([-0, 0]), 0)).toBe(true)
})
test('sampling empty input creates no fabricated values and validates the count', () => {
  expect(sample([], 3)).toEqual([])
  expect(sample([1], 0)).toEqual([])
  for (const count of [-1, NaN, Infinity, 1.5]) expect(() => sample([1], count)).toThrow(RangeError)
})
test('published selector types require callers to handle absent values', async () => {
  const root = resolve(import.meta.dir, '..')
  const built = Bun.spawnSync([process.execPath, 'run', 'build'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  expect(built.exitCode, built.stderr.toString()).toBe(0)
  const directory = await mkdtemp(join(tmpdir(), 'stacks-array-consumer-'))
  try {
    await writeFile(join(directory, 'client.ts'), `import {at,last} from ${JSON.stringify(join(root, 'dist/helpers'))}
const values:string[]=[]
const a:string|undefined=at(values, 99)
const b:string|undefined=last(values)
// @ts-expect-error absent results cannot be dereferenced
at(values,99).toUpperCase()
// @ts-expect-error arrays may be empty
last(values).toUpperCase()
`)
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, skipLibCheck: true, module: 'esnext', moduleResolution: 'bundler', types: [] }, files: ['client.ts'] }))
    const checked = Bun.spawnSync([resolve(root, '../../../../node_modules/.bin/tsc'), '--noEmit', '-p', join(directory, 'tsconfig.json')], { stdout: 'pipe', stderr: 'pipe' })
    expect(checked.exitCode, checked.stdout.toString() + checked.stderr.toString()).toBe(0)
  }
  finally { await rm(directory, { recursive: true, force: true }) }
}, 20_000)
test.skipIf(!findChrome())('array boundaries run in real Chrome', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/browser-boundaries.ts`, { envFile: false, preload: [], timeoutMs: 40_000 }), 'browser array boundaries OK')
}, 45_000)
