import { afterEach, describe, expect, it } from 'bun:test'
import { getActionRunner, runNamedAction, setActionRunner } from '../src/index'

/**
 * Three packages run actions by name without being the action layer: the queue
 * (a job that names one), the scheduler (`Schedule.action`) and the DNS package
 * (the domain shims). `@stacksjs/actions` imports all three, so importing it
 * back closed a cycle every time.
 *
 * The thing worth testing is what happens when nobody answered. A caller that
 * quietly does nothing marks a job complete, or reports a scheduled task as
 * run, with its work undone - the one outcome these callers must never produce.
 */

const original = getActionRunner()

afterEach(() => {
  setActionRunner(original ?? (async () => undefined))
})

describe('running an action by name', () => {
  it('hands the name to whoever registered', async () => {
    const seen: string[] = []
    setActionRunner(async (action) => {
      seen.push(String(action))
      return 'ran'
    })

    expect(await runNamedAction('SendWelcomeEmail')).toBe('ran')
    expect(seen).toEqual(['SendWelcomeEmail'])
  })

  it('passes options through, which the domain shims depend on', async () => {
    // `dns`'s addDomain calls runNamedAction(Action.DomainsAdd, options) and
    // returns what comes back; dropping the second argument would silently
    // run the action against no domain at all.
    let got: unknown
    setActionRunner(async (_action, options) => {
      got = options
      return { isOk: true, isErr: false }
    })

    const result = await runNamedAction('domains/add', { domain: 'example.com', verbose: true })

    expect(got).toEqual({ domain: 'example.com', verbose: true })
    expect(result).toEqual({ isOk: true, isErr: false })
  })

  it('reports the runner once one is registered', () => {
    expect(getActionRunner()).toBeTruthy()
    const mine = async () => 'x'
    setActionRunner(mine)
    expect(getActionRunner()).toBe(mine)
  })

  it('never silently does nothing when nobody registered', async () => {
    // Back to the unregistered state.
    setActionRunner(undefined as unknown as (action: string) => Promise<unknown>)
    expect(getActionRunner()).toBeUndefined()

    // With no runner the call falls back to importing the action layer. In
    // this checkout that import resolves, so the action really runs and fails
    // on its own terms - which is the point: the caller either runs the action
    // or hears about it, and is never quietly told the work is done.
    const outcome = await runNamedAction('SendWelcomeEmail').then(() => 'ran', () => 'threw')

    expect(outcome).toBe('threw')
    // And the resolved runner is cached, so a caller pays for it once.
    expect(getActionRunner()).toBeTruthy()
  })
})
