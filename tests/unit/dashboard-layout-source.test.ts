import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const layoutSource = readFileSync(
  resolve('storage/framework/defaults/views/dashboard/layouts/default.stx'),
  'utf8',
)

/**
 * The appearance bootstrap is the one place in this layout allowed to be raw
 * browser code.
 *
 * It stamps the chosen shell onto the root element and has to do it before the
 * markup below it is parsed, or every hard reload shows a frame of the wrong
 * shell. A `<script client>` block cannot: those are bundled and run after
 * hydration. So it is a bare `<script>` doing exactly the things the rest of
 * this file is forbidden from doing — `document`, `window`, `var`.
 *
 * Carving it out by name rather than relaxing the rule keeps the original
 * invariant intact for the remaining ~600 lines, which is the point of the
 * rule. Splitting the source is also what lets the assertions below stay exact
 * matches rather than degrading to "at most one of".
 */
const BOOTSTRAP = /<script>\n\s*\(function \(\) \{[\s\S]*?\}\)\(\)\n<\/script>/
const bootstrap = layoutSource.match(BOOTSTRAP)?.[0] ?? ''
const withoutBootstrap = layoutSource.replace(BOOTSTRAP, '')

describe('dashboard layout client architecture', () => {
  test('uses STX lifecycle and component events for sidebar navigation', () => {
    expect(layoutSource).toContain('useRef(\'dashboardSidebarHost\')')
    expect(layoutSource).toContain('useEventListener(\'stx:navigate\'')
    expect(layoutSource).toContain('onMount(() =>')
    expect(layoutSource).toContain('@itemClick="handleSidebarItemClick($event)"')
    expect(layoutSource).toContain('ensureCraftNativeSidebarMarker()')
    expect(layoutSource).toContain('data-dashboard-web-sidebar')
  })

  test('does not carry the legacy raw browser wiring', () => {
    expect(withoutBootstrap.match(/^<script\b[^>]*>$/gm)).toEqual([
      '<script server>',
      '<script client>',
    ])
    expect(withoutBootstrap).not.toContain('document.')
    expect(withoutBootstrap).not.toContain('window.')
    expect(withoutBootstrap).not.toMatch(/\bvar\s+/)
    expect(withoutBootstrap).not.toContain('__sidebarWired')
    expect(layoutSource).toContain('i-hugeicons-cancel-01')
    expect(layoutSource).not.toContain('<svg')
  })

  test('keeps the appearance bootstrap minimal and inline', () => {
    expect(bootstrap).not.toBe('')

    // It runs before the shell is parsed, so it cannot import or await
    // anything — the moment it does, it stops being a pre-paint script and the
    // flash it exists to prevent comes back.
    expect(bootstrap).not.toMatch(/\bimport\b/)
    expect(bootstrap).not.toMatch(/\bawait\b/)
    expect(bootstrap).not.toMatch(/\bfetch\(/)

    // Its whole job: read the stored preference and stamp the root element.
    expect(bootstrap).toContain('stacks-dashboard-appearance')
    expect(bootstrap).toContain('root.dataset.appearance')
    expect(bootstrap).toContain('root.dataset.theme')

    // And it has to survive storage being unavailable rather than taking the
    // page down with it — private browsing, quota, a hand-edited value.
    expect(bootstrap).toMatch(/catch\s*\(/)
  })
})
