import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_ROUTE_BUNDLE_FEATURES } from '../../storage/framework/core/router/src/route-loader'

const routes = (name: string) => readFileSync(join(import.meta.dir, '../../storage/framework/defaults/routes', `${name}.ts`), 'utf8')

describe('the newsletter signup routes mount without the dashboard', () => {
  const named = ['email.subscribe', 'email.confirm', 'email.unsubscribe', 'email.unsubscribe.oneclick']

  test('they are in the email bundle', () => {
    for (const name of named)
      expect(routes('email'), name).toContain(`.name('${name}')`)
  })

  test('the dashboard bundle no longer declares them', () => {
    for (const name of named)
      expect(routes('dashboard'), name).not.toContain(`.name('${name}')`)
  })

  test('the email bundle follows the email feature, not the dashboard', () => {
    expect(DEFAULT_ROUTE_BUNDLE_FEATURES.email).toBe('email')
  })

  test('a deployment can turn the signup off, but never the way out', () => {
    const source = routes('email')
    const gate = source.indexOf('newsletter?.signup !== false')
    expect(gate).toBeGreaterThan(-1)
    const block = source.slice(gate, source.indexOf('}\n', gate))
    expect(block).toContain(".name('email.subscribe')")
    expect(block).toContain(".name('email.confirm')")
    expect(block).not.toContain('email.unsubscribe')
  })
})
