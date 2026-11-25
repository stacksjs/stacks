import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '../..')
const action = readFileSync(join(root, 'storage/framework/defaults/app/Actions/SubscriberEmailAction.ts'), 'utf8')
const form = readFileSync(join(root, 'storage/framework/defaults/resources/components/Marketing/SubscribeForm.stx'), 'utf8')

describe('public signup does not reveal who has signed up', () => {
  test('an address already on the list is answered like a new one', () => {
    expect(action).not.toContain(`answer('already'`)
    expect(action).not.toContain('Already subscribed')
    expect(action).toContain('result.confirms ? pendingAnswer() : subscribedAnswer()')
  })

  test('the subscribed answer carries nothing about the address', () => {
    expect(action).not.toContain('Subscribed again')
    expect(action).not.toMatch(/subscriber:\s*\{\s*email/)
  })

  test('a filled honeypot is answered as success and stores nothing', () => {
    const honeypot = action.indexOf(`request.get('website')`)
    const stored = action.indexOf('await subscribe(email')
    expect(honeypot).toBeGreaterThan(-1)
    expect(honeypot).toBeLessThan(stored)
    expect(form).toContain('name="website"')
    expect(form).toContain('website: website()')
  })

  test('the default list can be made double opt-in from config', () => {
    expect(action).toContain('config.email?.newsletter?.doubleOptIn === true')
    expect(action).toContain('defaultListDoubleOptIn })')
  })
})
