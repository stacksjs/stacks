/**
 * Commerce ships off (stacksjs/stacks#2476).
 *
 * A new app used to get the whole commerce schema whether it wanted it or
 * not: gift cards, loyalty rewards, delivery routes and restaurant waitlists
 * on a one-page site with a contact form.
 *
 * `buddy new` ships this repository's tree, so `config/commerce.ts` here IS
 * the default a new app starts from. Flipping it is the entire fix, because
 * `hideDisabledFeatureMigrations` already renames every migration owned by a
 * disabled feature to `.sql.disabled` before anything executes.
 *
 * Deliberately NOT tested by importing the config: `feature()` reads the
 * merged proxy, so a test that awaited `overridesReady` would pass on a
 * machine whose own config had drifted. The committed file is the artifact
 * that ships.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const commerceConfig = readFileSync(resolve('config/commerce.ts'), 'utf8')

describe('commerce is opt-in', () => {
  test('the shipped config disables it', () => {
    // The top-level flag, which is the one `feature('commerce')` reads.
    // Nested `enabled` keys belong to sub-features and are not this.
    const topLevel = commerceConfig.slice(
      commerceConfig.indexOf('export default {'),
      commerceConfig.indexOf('\n  /**'),
    )

    expect(topLevel).toContain('enabled: false')
    expect(topLevel).not.toContain('enabled: true')
  })

  test('turning it on is a documented one-command path', () => {
    // If commerce is off by default, the way back on has to be discoverable
    // from the file itself - otherwise the default reads as a bug.
    expect(commerceConfig).toContain('commerce:install')
  })

  test('the flag it sets is the one the feature gate reads', () => {
    // `feature()` short-circuits on an explicit `enabled: false` and otherwise
    // treats a present config object as on. A rename of this field would make
    // the default silently ineffective while this file still looked correct.
    const features = readFileSync(
      resolve('storage/framework/core/config/src/features.ts'),
      'utf8',
    )

    expect(features).toContain('const enabledField = cfg.enabled')
    expect(features).toContain('if (enabledField === false) return false')
  })
})
