/**
 * That the generated handlers actually consult a policy, and where
 * (stacksjs/stacks#2883).
 *
 * `policyDecision` is unit-tested in auto-crud.test.ts, and being correct
 * proves nothing about whether the six handlers call it. That is this issue's
 * recurring shape: the primitive was right and no caller reached it, which is
 * exactly how `policy.ts` came to declare Nova's whole vocabulary while 0 of
 * the 750 default actions consulted it.
 *
 * Asserted against the generator's source because the alternative is not
 * available: there is no harness that issues HTTP requests at the generated
 * routes, since they need a database and a server. Position matters as much as
 * presence here - a policy asked before the 404 check leaks which ids exist,
 * and one asked after the delete is not a gate - so the ordering is pinned too.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { POLICY_ABILITY } from '../src/auto-crud'

const generator = readFileSync(join(import.meta.dir, '..', 'src', 'routes.ts'), 'utf8')

/** Where a snippet sits in the generator, or -1. */
const at = (needle: string, from = 0) => generator.indexOf(needle, from)

/**
 * The generator's source between two markers.
 *
 * The end marker is searched FROM the start one, not from zero: `bulk-delete`
 * appears in a route-shape list long before the handler that registers it, so
 * a slice anchored from zero came back empty and the ordering assertion passed
 * vacuously.
 */
/**
 * The index of `needle` in `haystack`, asserting it is there.
 *
 * Every ordering check here is `indexOf(a) < indexOf(b)`, and a missing needle
 * is -1, which is less than everything. Deleting the thing under test made the
 * assertion pass rather than fail: caught by mutation-checking these, which is
 * the only reason this helper exists.
 */
function indexOfExisting(haystack: string, needle: string): number {
  const index = haystack.indexOf(needle)
  expect(index, `missing: ${needle}`).toBeGreaterThan(-1)
  return index
}

function between(startNeedle: string, endNeedle: string): string {
  const start = at(startNeedle)
  expect(start, `missing marker: ${startNeedle}`).toBeGreaterThan(-1)
  const end = at(endNeedle, start)
  expect(end, `missing marker after ${startNeedle}: ${endNeedle}`).toBeGreaterThan(start)
  return generator.slice(start, end)
}

describe('policy consultation in the generated handlers', () => {
  it('consults every ability the trait generates a route for', () => {
    for (const [route, ability] of Object.entries(POLICY_ABILITY))
      expect(generator, `${route} should consult ${ability}`).toContain(`policyRefusal(modelName, '${ability}'`)
  })

  it('returns the refusal rather than computing it and dropping it', () => {
    // Six call sites, six returns. An awaited check whose result is ignored is
    // the most plausible way for this to look wired and gate nothing.
    const calls = generator.match(/policyRefusal\(modelName, '/g) ?? []
    const returns = generator.match(/if \(refused\w*\) return refused\w*|if \(await policyRefusal\(/g) ?? []

    expect(calls.length).toBe(6)
    expect(returns.length).toBe(6)
  })

  it('asks viewAny before building the listing', () => {
    expect(indexOfExisting(generator, `policyRefusal(modelName, 'viewAny'`))
      .toBeLessThan(indexOfExisting(generator, 'let query = dyn.selectFrom(table)'))
  })

  it('asks view only about a row the caller could otherwise have seen', () => {
    // After the 404 and the ownership check. Asked earlier, a policy that
    // refuses would answer differently for an id that exists and one that does
    // not, which tells an outsider which ids exist in other tenants - the
    // reason those checks answer 404 rather than 403.
    const show = between(`if (enabledRoutes.includes('show')`, `enabledRoutes.includes('store')`)

    const askedView = indexOfExisting(show, `policyRefusal(modelName, 'view'`)

    expect(indexOfExisting(show, modelNotFound())).toBeLessThan(askedView)
    expect(indexOfExisting(show, 'own.enforced && !own.bypass')).toBeLessThan(askedView)
  })

  it('asks delete before the row is deleted', () => {
    const destroy = between(`enabledRoutes.includes('destroy') && !routeClaimed('DELETE'`, 'bulk-delete')

    expect(indexOfExisting(destroy, `policyRefusal(modelName, 'delete'`))
      .toBeLessThan(indexOfExisting(destroy, 'dyn.deleteFrom(table)'))
  })

  it('asks about every row of a bulk delete before deleting any of them', () => {
    // A bulk delete that refused halfway would leave the caller's own request
    // half applied, with no way to tell which half.
    const bulk = generator.slice(at(`enabledRoutes.includes('destroy') && !routeClaimed('POST'`))

    expect(indexOfExisting(bulk, `policyRefusal(modelName, 'delete'`))
      .toBeLessThan(indexOfExisting(bulk, 'const now = new Date().toISOString()'))
    expect(bulk).toContain('refusedRows.length > 0')
  })

  it('does not pay a query per row for a model with no policy', () => {
    // The bulk path is the one place consulting a policy costs a SELECT, since
    // it needs the row as the subject. Unguarded, every bulk delete on the 107
    // models that have no policy would pay one per id.
    const bulk = generator.slice(at(`enabledRoutes.includes('destroy') && !routeClaimed('POST'`))

    expect(indexOfExisting(bulk, 'await hasPolicyFor(modelName)'))
      .toBeLessThan(indexOfExisting(bulk, `policyRefusal(modelName, 'delete'`))
  })

  it('resolves the caller lazily, so an unpoliced route resolves nobody', () => {
    // `policyDecision` calls `deps.user()` only after `hasPolicy`, which is
    // only true if the dependency is passed as a thunk rather than awaited at
    // the call site.
    expect(generator).toContain('user: () => authedUserFromRequest(req)')
    expect(generator).not.toMatch(/user:\s*await\s+authedUserFromRequest/)
  })
})

/** The 404 both read handlers answer with, as the generator spells it. */
function modelNotFound(): string {
  return 'not found'
}
