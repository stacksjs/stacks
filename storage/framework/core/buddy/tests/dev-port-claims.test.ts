import { describe, expect, it } from 'bun:test'
import { claimDevPorts } from '../src/commands/dev'

/**
 * `buddy dev` starts several servers and steps each one past a port another
 * project already holds. The steps used to be independent, so with :3006 and
 * :3007 busy the docs server walked to :3008, the port this project's own API
 * was about to bind, and the banner printed both on :3008.
 */
const servers = [
  { label: 'Frontend', preferred: 3000 },
  { label: 'API', preferred: 3008 },
  { label: 'Docs', preferred: 3006 },
  { label: 'Dashboard', preferred: 3002 },
]

const busy = (...ports: number[]) => async (port: number): Promise<boolean> => !ports.includes(port)

describe('the ports buddy dev gives its servers', () => {
  it('keeps every preferred port when all are free', async () => {
    expect(await claimDevPorts(servers, busy())).toEqual({ ports: [3000, 3008, 3006, 3002], shifts: [] })
  })

  it('never moves a server onto a port another server here prefers', async () => {
    const { ports, shifts } = await claimDevPorts(servers, busy(3000, 3006, 3007))

    expect(ports).toEqual([3001, 3008, 3009, 3002])
    expect(shifts).toEqual(['Frontend :3000 → :3001', 'Docs :3006 → :3009'])
    expect(new Set(ports).size).toBe(ports.length)
  })

  it('separates two servers configured onto the same port', async () => {
    const { ports } = await claimDevPorts([
      { label: 'Frontend', preferred: 3000 },
      { label: 'API', preferred: 3000 },
    ], busy())

    expect(ports).toEqual([3000, 3001])
  })

  it('does not reuse a port it already moved another server to', async () => {
    const { ports } = await claimDevPorts([
      { label: 'Frontend', preferred: 3000 },
      { label: 'Docs', preferred: 3000 },
      { label: 'Dashboard', preferred: 3000 },
    ], busy(3000))

    expect(ports).toEqual([3001, 3002, 3003])
  })

  it('hands back the preferred port when the whole window is taken', async () => {
    const { ports, shifts } = await claimDevPorts([{ label: 'API', preferred: 3008 }], async () => false, 5)

    expect(ports).toEqual([3008])
    expect(shifts).toEqual([])
  })
})
