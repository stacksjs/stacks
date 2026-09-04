import { describe, expect, it } from 'bun:test'
import { parseProcStatusRss, parsePsRss } from './process'

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
})
