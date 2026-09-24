import type { LintConfig } from '@stacksjs/types'

/**
 * Lint configuration.
 *
 * Code style lives in `config/code-style.ts` (pickier's own options). This file
 * holds the checks Stacks runs on top of it - today, the stx conformance
 * checks behind `buddy lint --stx`.
 *
 * The baselines are a ratchet. A number is a DEBT, not a target: going above
 * one fails, and dropping below one is reported too, so a cleared violation has
 * to be recorded rather than quietly banked. Every non-zero entry names what
 * clears it.
 */
const config: LintConfig = {
  stx: {
    baselines: {
      'comment-landmine': 0,
      'dist-component-error': 0,
      'dist-layout-published': 0,
      'dist-path-leak': 0,
      'script-tag-balance': 0,
      'strict-lint': 0,
      'unmanaged-timer': 0,
      'style-block': 0,
      'dom-guard': 0,
      'inline-style-attr': 0,
      'plain-internal-anchor': 0,

      // config/ui.ts sets neither `strict` nor `pagesDir`. Pinning pagesDir
      // changes how stx resolves topology, so it wants its own dev+build pass
      // rather than being swept in with a lint change.
      'stx-config-keys': 2,

      // resources/emails/order-confirmation.stx is a whole email document, so
      // it owns its DOCTYPE.
      'doctype-no-nolayout': 1,
    },
  },
}

export default config
