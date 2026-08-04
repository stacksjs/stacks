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
      // Held at zero - each of these breaks a page or silently drops content.
      'comment-landmine': 0,
      'dist-component-error': 0,
      'dist-layout-published': 0,
      'dist-path-leak': 0,
      'script-tag-balance': 0,
      'strict-lint': 0,
      'unmanaged-timer': 0,

      // config/ui.ts sets none of strict/root/pagesDir. Pinning root+pagesDir
      // changes how stx resolves topology, so it wants its own dev+build pass
      // rather than being swept in with a lint change.
      'stx-config-keys': 3,

      // The marketing and desktop shells still own their DOCTYPE. Blocked on
      // stacksjs/stx#1798 (generateDocumentShell htmlAttrs) - without it,
      // removing the shell drops the class the landing-page tokens are scoped to.
      'doctype-no-nolayout': 5,

      // Two templates still carry a <style> block; the destination is
      // config/crosswind.ts preflights.
      'style-block': 2,

      // coming-soon.stx and index.stx are still imperative.
      'dom-guard': 3,

      // Mostly the desktop demo components, plus pre-hydration display:none
      // whose sanctioned form is a :class with literal branches.
      'inline-style-attr': 49,

      // One unrouted <a href="/"> left (index.stx's brand link). Anchors
      // carrying data-stx-link or data-no-router are not counted: both already
      // declare what they are.
      'plain-internal-anchor': 1,
    },
  },
}

export default config
