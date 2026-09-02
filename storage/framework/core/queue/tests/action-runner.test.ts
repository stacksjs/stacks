import { afterEach, describe, expect, it } from 'bun:test'
import { Job } from '../src/action'
import { getActionRunner, runNamedAction, setActionRunner } from '../src/action-runner'

/**
 * A job may name an action as a string rather than hand over a function, and
 * running it belongs to `@stacksjs/actions`. The queue used to import that
 * package directly, which put it - and nine packages with it - inside the
 * framework's dependency cycle. It asks now, and the action layer answers by
 * registering itself on import.
 *
 * The thing worth testing is what happens when nobody answered. A queue that
 * quietly does nothing marks a job complete with its work undone, which is the
 * one outcome a queue must never produce.
 */

const original = getActionRunner()

afterEach(() => {
  setActionRunner(original ?? (async () => undefined))
})

describe('running an action a job named', () => {
  it('hands the name to whoever registered', async () => {
    const seen: string[] = []
    setActionRunner(async (action) => {
      seen.push(action)
      return 'ran'
    })

    expect(await runNamedAction('SendWelcomeEmail')).toBe('ran')
    expect(seen).toEqual(['SendWelcomeEmail'])
  })

  it('reaches the runner through a job that names one', async () => {
    const seen: string[] = []
    setActionRunner(async (action) => {
      seen.push(action)
    })

    await new Job({ name: 'Welcome', action: 'SendWelcomeEmail' }).dispatchNow()

    // The whole point of the indirection: the job still runs its action
    // without the queue importing the package that knows how.
    expect(seen).toEqual(['SendWelcomeEmail'])
  })

  it('prefers a handler over a named action', async () => {
    let named = false
    setActionRunner(async () => { named = true })

    let handled = false
    await new Job({ name: 'Direct', handle: () => { handled = true } }).dispatchNow()

    expect(handled).toBe(true)
    expect(named).toBe(false)
  })

  it('never silently does nothing when nobody registered', async () => {
    // Back to the unregistered state.
    setActionRunner(undefined as unknown as (action: string) => Promise<unknown>)
    expect(getActionRunner()).toBeUndefined()

    // With no runner, the call falls back to importing the action layer. In
    // this checkout that import resolves, so the action really runs and fails
    // on its own terms - which is the point: the job is never quietly marked
    // done with its work undone.
    const outcome = await runNamedAction('SendWelcomeEmail').then(() => 'ran', () => 'threw')

    expect(outcome).toBe('threw')
    // And the resolved runner is cached, so a worker pays for it once.
    expect(getActionRunner()).toBeTruthy()
  })

})
