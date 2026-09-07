import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseProcChildren, parseProcStatusRss, parsePsProcessTreeRss, parsePsRss, residentProcTreeBytes } from './process'

describe('RSS parsers', () => {
  it('reads VmRSS from Linux process status', () => {
    expect(parseProcStatusRss('Name:\tbun\nVmPeak:\t120000 kB\nVmRSS:\t54321 kB\n')).toBe(54_321 * 1024)
  })

  it('reads ps output in KiB', () => {
    expect(parsePsRss('  12345\n')).toBe(12_345 * 1024)
  })

  it('reads Linux child lists', () => {
    expect(parseProcChildren('101  102\n')).toEqual([101, 102])
    expect(parseProcChildren('\n')).toEqual([])
    expect(parseProcChildren('invalid 0 -1 103')).toEqual([103])
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

  it('sums a Linux process tree across every root thread', async () => {
    const procRoot = mkdtempSync(join(tmpdir(), 'stacks-proc-fixture-'))
    const process = (pid: number, rssKiB: number, tasks: Record<number, string>) => {
      writeFileSync(join(procRoot, String(pid), 'status'), `Name:\tbun\nVmRSS:\t${rssKiB} kB\n`)
      for (const [taskId, children] of Object.entries(tasks)) {
        mkdirSync(join(procRoot, String(pid), 'task', taskId), { recursive: true })
        writeFileSync(join(procRoot, String(pid), 'task', taskId, 'children'), children)
      }
    }
    try {
      mkdirSync(join(procRoot, '100'), { recursive: true })
      mkdirSync(join(procRoot, '101'), { recursive: true })
      mkdirSync(join(procRoot, '102'), { recursive: true })
      mkdirSync(join(procRoot, '103'), { recursive: true })
      process(100, 1_000, { 100: '101', 110: '102' })
      process(101, 2_000, { 101: '103' })
      process(102, 3_000, { 102: '' })
      process(103, 4_000, { 103: '' })
      expect(await residentProcTreeBytes(100, procRoot)).toBe(10_000 * 1024)
      expect(await residentProcTreeBytes(999, procRoot)).toBeNull()
    }
    finally {
      rmSync(procRoot, { recursive: true, force: true })
    }
  })
})
