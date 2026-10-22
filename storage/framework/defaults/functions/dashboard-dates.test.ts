import { describe, expect, it } from 'bun:test'

/**
 * Run `parseDashboardDate` in a process pinned to `zone`, since a calendar
 * date only goes wrong west of UTC and a test process's zone is fixed at
 * start-up.
 */
async function inZone(zone: string, expression: string): Promise<string> {
  const child = Bun.spawn([process.execPath, '--no-env-file', '-e', `
    const { parseDashboardDate } = await import(${JSON.stringify(`${import.meta.dir}/dashboard-dates.ts`)})
    console.log(${expression})
  `], { env: { ...process.env, TZ: zone }, stdout: 'pipe', stderr: 'pipe' })
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(code, err).toBe(0)
  return out.trim()
}

const calendarDay = `[parseDashboardDate('2026-10-01')].map(d => [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-'))[0]`

describe('parseDashboardDate', () => {
  for (const zone of ['America/Los_Angeles', 'UTC', 'Asia/Manila', 'Pacific/Kiritimati']) {
    it(`reads a calendar date as that day in ${zone}`, async () => {
      expect(await inZone(zone, calendarDay)).toBe('2026-10-1')
    })
  }

  it('reads an offsetless database timestamp as UTC, wherever it runs', async () => {
    for (const zone of ['America/Los_Angeles', 'Asia/Manila'])
      expect(await inZone(zone, `parseDashboardDate('2026-10-01 14:30:00').toISOString()`)).toBe('2026-10-01T14:30:00.000Z')
  })

  it('leaves an ISO string with an offset, and a Date, as they are', async () => {
    expect(await inZone('America/Los_Angeles', `parseDashboardDate('2026-10-01T14:30:00+08:00').toISOString()`)).toBe('2026-10-01T06:30:00.000Z')
    const at = new Date('2026-10-01T00:00:00Z')
    const { parseDashboardDate } = await import('./dashboard-dates')
    expect(parseDashboardDate(at)).toBe(at)
  })

  it('the reading it replaces is the bug: a calendar date lands on the day before west of UTC', async () => {
    // The control. Without it, every assertion above would pass in a zone
    // where the two readings agree.
    expect(await inZone('America/Los_Angeles', `[new Date('2026-10-01')].map(d => d.getDate())[0]`)).toBe('30')
  })
})
