import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, test } from 'bun:test'
import { renderTemplate } from '@stacksjs/stx'
import { resolveDefaultsResources } from '../src/dev/defaults-resources'

/**
 * The site servers search the app's `resources/components` first and the
 * framework's as `fallbackComponentsDir`, so `buddy publish:component`
 * overrides one by name. That has to hold where a framework component renders
 * a sibling from its own folder too: a nested component resolves beside its
 * parent first, and the framework's copy used to win (stacksjs/stacks#3033).
 * `HelloWorld` renders `<Logo>`, and both sit at the top of the framework's
 * components.
 */
const scratch = mkdtempSync(join(tmpdir(), 'site-component-overrides-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

const frameworkComponents = join(resolveDefaultsResources(), 'components')

async function renderHelloWorld(appComponents: string): Promise<string> {
  const page = join(scratch, `page-${Math.random().toString(36).slice(2)}.stx`)
  writeFileSync(page, '<div><HelloWorld /></div>\n')
  return renderTemplate(page, { options: { componentsDir: appComponents, fallbackComponentsDir: frameworkComponents } })
}

test('an app copy of a component wins inside the framework component that renders it', async () => {
  const app = mkdtempSync(join(scratch, 'app-'))
  writeFileSync(join(app, 'Logo.stx'), '<span data-app-logo="1"></span>\n')

  const html = await renderHelloWorld(app)
  expect(html).toContain('data-app-logo="1"')
}, 60_000)

test('without an app copy the framework sibling still renders', async () => {
  const html = await renderHelloWorld(mkdtempSync(join(scratch, 'empty-')))
  expect(html).not.toContain('data-app-logo')
  expect(html).not.toContain('could not be resolved')
}, 60_000)
