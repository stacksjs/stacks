/**
 * The newsletter signup is a framework feature: one component, one endpoint.
 *
 * `<SubscribeForm>` ships in the framework defaults and every signup on
 * stacksjs.com (and the framework's own ComingSoon page) uses it, so a fix to
 * the form or its messages lands everywhere at once. These pin that, and the
 * component's own contract: stx bindings, a plain-form fallback, and an
 * answer for every outcome the endpoint can give.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { subscribeOutcomeFrom } from '../../resources/data/blog'

const root = join(import.meta.dir, '../..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const component = read('storage/framework/defaults/resources/components/Marketing/SubscribeForm.stx')

describe('SubscribeForm', () => {
  test('is bound with stx, not by querying the document', () => {
    expect(component).toContain('@submit.prevent="submit()"')
    expect(component).toContain('x-model.trim="email"')
    expect(component).not.toMatch(/document\.|window\.|querySelector/)
  })

  test('still posts as a plain form without JavaScript', () => {
    expect(component).toContain('action="/api/email/subscribe"')
    expect(component).toContain('method="POST"')
    for (const field of ['source', 'list', 'return'])
      expect(component).toContain(`name="${field}"`)
  })

  test('has something to say for every outcome the endpoint gives', () => {
    const action = read('storage/framework/defaults/app/Actions/SubscriberEmailAction.ts')
    const outcomes = action.match(/type Outcome = ([^\n]+)/)?.[1]?.match(/'([a-z]+)'/g)?.map(s => s.slice(1, -1)) ?? []
    expect(outcomes.sort()).toEqual(['already', 'busy', 'error', 'invalid', 'subscribed'])
    for (const outcome of outcomes)
      expect(component).toContain(`'${outcome}'`)
  })

  test('styles itself at zero specificity so an app can restyle it', () => {
    const style = component.slice(component.indexOf('<style>'))
    const selectors = style.match(/^\s{2}[^\s@}][^{]*\{/gm) ?? []
    expect(selectors.length).toBeGreaterThan(5)
    for (const selector of selectors)
      expect(selector.trim().startsWith(':where(')).toBe(true)
  })
})

describe('every signup uses it', () => {
  for (const file of [
    'resources/partials/blog-subscribe.stx',
    'resources/views/index.stx',
    'resources/views/coming-soon.stx',
    'storage/framework/defaults/resources/components/Marketing/ComingSoon.stx',
  ]) {
    test(file, () => {
      const source = read(file)
      expect(source).toContain('<SubscribeForm')
      // No page talks to the endpoint by hand any more.
      expect(source.replace(/\{\{--[\s\S]*?--\}\}/g, '')).not.toMatch(/fetch\(['"]\/api\/email\/subscribe/)
    })
  }
})

describe('the ?subscribe= a page comes back with', () => {
  test('names an outcome or nothing', () => {
    expect(subscribeOutcomeFrom({ subscribe: 'busy' })).toBe('busy')
    expect(subscribeOutcomeFrom({ subscribe: 'toString' })).toBe('')
    expect(subscribeOutcomeFrom({})).toBe('')
    expect(subscribeOutcomeFrom(undefined)).toBe('')
  })
})
