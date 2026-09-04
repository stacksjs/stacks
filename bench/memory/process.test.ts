import { describe, expect, it } from 'bun:test'
import { parseProcStatusRss, parsePsProcessTreeRss, parsePsRss } from './process'

describe('RSS parsers', () => {
  it('reads VmRSS from Linux process status', () => {
    expect(parseProcStatusRss('Name:\tbun\nVmPeak:\t120000 kB\nVmRSS:\t54321 kB\n')).toBe(54_321 * 1024)
  })

  it('reads ps output in KiB', () => {
    expect(parsePsRss('  12345\n')).toBe(12_345 * 1024)
  })

  it('rejects missing or invalid readings', () => {
    expect(parseProcStatusRss('Name:\tbun\n')).toBeNull()
    expect(parsePsRss('')).toBeNull()
    expect(parsePsRss('process exited')).toBeNull()
  })

  it('sums the server process and every descendant without counting siblings', () => {
    const table = [
      '100 1 1000',
      '101 100 2000',
      '102 101 3000',
      '200 1 9000',
    ].join('\n')

    expect(parsePsProcessTreeRss(table, 100)).toBe(6_000 * 1024)
  })
})
