import { describe, expect, it } from 'bun:test'

/**
 * Port collisions between tenants on a shared box.
 *
 * ts-cloud's units do not bind exclusively, so two services CAN hold the same
 * port: the kernel load-balances between them instead of refusing the second.
 * Nothing errors and both units look healthy, but each domain then serves the
 * other tenant's site on roughly half its requests.
 *
 * That is not hypothetical. A storefront picked 3070 by grepping other tenants'
 * config files instead of asking the box what was listening. predicthq.org had
 * been on 3070 for a day and a half; after the deploy it answered with the
 * storefront, and the storefront answered with predicthq.
 *
 * The guard reads `ss -lntp` on the box and resolves each holder to its systemd
 * unit, because the unit name is what separates a redeploy replacing itself
 * from a genuine collision with somebody else.
 */

/** Which of the ports we want are held by a unit that is not ours. */
function collisions(
  wanted: Map<number, string>,
  holders: Array<{ port: number, unit: string }>,
  slug: string,
): Array<{ port: number, unit: string }> {
  return holders.filter(h => wanted.has(h.port) && !h.unit.startsWith(`${slug}-`))
}

const WANTED = new Map([[3110, 'main'], [3118, 'api']])

describe('port collision detection', () => {
  it('catches the collision that hijacked predicthq.org', () => {
    const wanted = new Map([[3070, 'main'], [3078, 'api']])
    const holders = [{ port: 3070, unit: 'predicthq-main@8e4d6f9.service' }]

    expect(collisions(wanted, holders, 'erbamarkets')).toEqual([
      { port: 3070, unit: 'predicthq-main@8e4d6f9.service' },
    ])
  })

  it('stays quiet when the ports are genuinely free', () => {
    expect(collisions(WANTED, [{ port: 3070, unit: 'predicthq-main@8e4d6f9.service' }], 'erbamarkets')).toEqual([])
  })

  it('treats our own unit holding the port as a redeploy, not a clash', () => {
    // Every redeploy hits this: the old revision is still listening when the
    // preflight runs, and failing there would block all redeploys.
    const holders = [{ port: 3110, unit: 'erbamarkets-main@8164cda.service' }]

    expect(collisions(WANTED, holders, 'erbamarkets')).toEqual([])
  })

  it('does not let a shared name prefix pass as ours', () => {
    // 'erba' is a prefix of 'erbamarkets', but they are different projects and
    // the trailing dash is what keeps them apart.
    const holders = [{ port: 3110, unit: 'erbamarkets-main@1.service' }]

    expect(collisions(WANTED, holders, 'erba')).toEqual(holders)
  })

  it('reports every clashing site, not just the first', () => {
    const holders = [
      { port: 3110, unit: 'predicthq-main@a.service' },
      { port: 3118, unit: 'openfarming-api@b.service' },
    ]

    expect(collisions(WANTED, holders, 'erbamarkets')).toHaveLength(2)
  })

  it('ignores ports this project never asked for', () => {
    expect(collisions(WANTED, [{ port: 3000, unit: 'stacks-main@c.service' }], 'erbamarkets')).toEqual([])
  })
})
