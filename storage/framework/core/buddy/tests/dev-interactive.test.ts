import { describe, expect, it } from 'bun:test'
import { dispatchInteractiveDevSelection, interactiveDevChoices, resolvePrettyDevDomain } from '../src/commands/dev'

describe('buddy dev interactive selection', () => {
  it('dispatches every visible choice to exactly one runner', async () => {
    const calls: string[] = []
    const runners = Object.fromEntries(
      interactiveDevChoices.map(choice => [choice.value, async () => calls.push(choice.value)]),
    ) as Parameters<typeof dispatchInteractiveDevSelection>[1]

    for (const choice of interactiveDevChoices) {
      calls.length = 0
      expect(await dispatchInteractiveDevSelection(choice.value, runners)).toBe(true)
      expect(calls).toEqual([choice.value])
    }
  })

  it('rejects values that are not displayed', async () => {
    const runners = Object.fromEntries(
      interactiveDevChoices.map(choice => [choice.value, async () => {}]),
    ) as Parameters<typeof dispatchInteractiveDevSelection>[1]

    expect(await dispatchInteractiveDevSelection('email', runners)).toBe(false)
  })
})

describe('buddy dev URL selection', () => {
  it('keeps loopback URLs on the zero-setup localhost path', () => {
    expect(resolvePrettyDevDomain('http://localhost:3000')).toBeNull()
    expect(resolvePrettyDevDomain('localhost')).toBeNull()
    expect(resolvePrettyDevDomain('http://127.0.0.1:3000')).toBeNull()
  })

  it('recognizes explicitly configured pretty domains', () => {
    expect(resolvePrettyDevDomain('stacks.localhost')).toBe('stacks.localhost')
    expect(resolvePrettyDevDomain('https://app.example.com')).toBe('app.example.com')
  })
})
