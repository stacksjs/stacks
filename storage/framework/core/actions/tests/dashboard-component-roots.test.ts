import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, test } from 'bun:test'
import { renderTemplate } from '@stacksjs/stx'
import { resolveComponentsLibraryRoot } from '../src/dev/defaults-resources'

/**
 * The dashboard layout renders `<Sidebar>` and `<SidebarHeader>`, which ship in
 * `@stacksjs/components`, not in defaults. Registration used to come only from
 * an app's own `config/ui.ts` plugins key, so an app scaffolded before that key
 * existed rendered the layout as an ENOENT dump (stacksjs/stacks#2641).
 *
 * The component search roots are what this pins, not a running server: the
 * resolver reads them off the render options the dev server passes to `serve()`.
 */
const scratch = mkdtempSync(join(tmpdir(), 'dashboard-component-roots-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

const dashboardComponents = join(import.meta.dir, '../../../defaults/resources/components/Dashboard')

/**
 * Both shapes an unresolved component takes, because this answered `true` for
 * one of them.
 *
 * Up to `@stacksjs/stx` 0.2.343 the renderer dumped
 * `[Error loading component: ENOENT …]` and its searched paths into the page,
 * so looking for that string was a complete test. From 0.2.345 it leaves a
 * comment and reports the paths to the console instead (stacksjs/stx#2004), so
 * the string never appears and the old check reported every component as
 * resolved - including, in the negative cases below, ones that genuinely were
 * not. The positive cases passed too, which is the worse half: this test would
 * have gone on guarding #2641 while measuring nothing.
 */
const UNRESOLVED = ['Error loading component', 'could not be resolved']

async function resolves(tag: string, options: Record<string, unknown>): Promise<boolean> {
  const html = await render(tag, options)
  return !UNRESOLVED.some(marker => html.includes(marker))
}

async function render(tag: string, options: Record<string, unknown>): Promise<string> {
  const page = join(scratch, `${tag}-${Math.random().toString(36).slice(2)}.stx`)
  writeFileSync(page, `<div><${tag}>x</${tag}></div>\n`)
  return renderTemplate(page, { options: { componentsDir: dashboardComponents, ...options } })
}

test('the components library root resolves to a directory holding the sidebar sources', () => {
  const root = resolveComponentsLibraryRoot()
  expect(root, '@stacksjs/components must be resolvable from this package').toBeTruthy()
  expect(Bun.file(join(root!, 'ui/sidebar/Sidebar.stx')).size).toBeGreaterThan(0)
})

test('the dashboard component roots resolve the layout tags without an app plugin registration', async () => {
  const fallbackComponentsDir = resolveComponentsLibraryRoot()

  // Framework-owned components keep resolving from the dashboard directory.
  expect(await resolves('MobileSidebar', { fallbackComponentsDir })).toBe(true)

  // The components package tags the layout needs. Without the fallback root
  // these are the ENOENT dump the issue reported.
  for (const tag of ['Sidebar', 'SidebarHeader']) {
    expect(await resolves(tag, {}), `${tag} must not resolve without the library root`).toBe(false)
    expect(await resolves(tag, { fallbackComponentsDir }), `${tag} must resolve through the library root`).toBe(true)
  }

  // Asserted on the markup, not only on the absence of a failure marker. A
  // check that can only say "nothing went wrong" reports success when the
  // marker it looks for is the thing that changed, which is exactly how this
  // test came to measure nothing. `Sidebar.stx` renders an <aside> carrying
  // its own data attributes; neither is in the page this writes.
  const sidebar = await render('Sidebar', { fallbackComponentsDir })
  expect(sidebar, 'a resolved Sidebar must render its own markup').toContain('<aside')
  expect(sidebar, 'a resolved Sidebar must render its own data attributes').toContain('data-sidebar')
}, 20_000)

test('the published dist is not a usable component root', async () => {
  // Its .stx files are content-hashed (Sidebar-f1tff5p3.stx), so name-based
  // resolution cannot hit them. The issue suggested pointing at dist.
  const dist = join(resolveComponentsLibraryRoot()!, '../dist')
  expect(await resolves('Sidebar', { fallbackComponentsDir: dist })).toBe(false)
}, 20_000)

/**
 * The helper is only useful if both dashboard servers actually pass it. Pinned
 * against the source because the options object is built inline inside each
 * server's startup path, with no seam to call.
 */
test('both dashboard servers pass the library root to serve()', async () => {
  for (const file of ['../src/dev/dashboard.ts', '../src/serve/dashboard.ts']) {
    const source = await Bun.file(join(import.meta.dir, file)).text()
    expect(source, `${file} must register the component library root`).toContain('fallbackComponentsDir: resolveComponentsLibraryRoot(),')
    expect(source).toContain('componentsDir:')
  }
})
