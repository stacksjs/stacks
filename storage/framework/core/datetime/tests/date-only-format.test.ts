import { format } from '../src/format'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'
import { expect, test } from 'bun:test'

for (const timeZone of ['America/Los_Angeles', 'Asia/Tokyo']) {
  test(`date-only parsing and formatting agree in ${timeZone}`, async () => {
    const result = await runIsolated(`${import.meta.dir}/fixtures/date-only-format.ts`, { env: { TZ: timeZone }, preload: [], envFile: false })
    assertIsolatedOk(result)
    expect(JSON.parse(result.stdout)).toEqual(['2024-06-15', '2024-06-15', '2024-06-15'])
  })
}

test('format keeps rejecting impossible ISO date-only components', () => {
  for (const input of ['2024-13-01', '2024-01-32', '2024-00-10'])
    expect(() => format(input)).toThrow('Invalid date')
})
