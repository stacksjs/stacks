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

async function resolves(tag: string, options: Record<string, unknown>): Promise<boolean> {
  const page = join(scratch, `${tag}-${Math.random().toString(36).slice(2)}.stx`)
  writeFileSync(page, `<div><${tag}>x</${tag}></div>\n`)
  const html = await renderTemplate(page, { options: { componentsDir: dashboardComponents, ...options } })
  return !html.includes('Error loading component')
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
