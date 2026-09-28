import { afterEach, describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import process from 'node:process'
import { compileTemplate, hydrateTemplateStream } from '@stacksjs/stx'

/**
 * The default `errors/tester` view is a development tool.
 *
 * The routes that fill it (`/test-error/*`) are mounted only for a local
 * deployment, but the view fallback served the file on its own: every deployed
 * app answered 200 at /errors/tester with an "Error Page Tester" heading
 * (found live on uplink.stacksjs.com). Compiled from the real file, and
 * rendered the way the server does, under each environment.
 */

const VIEW = join(import.meta.dir, '../../../defaults/resources/views/errors/tester.stx')
const KEYS = ['APP_ENV', 'NODE_ENV', 'APP_URL'] as const
const saved = Object.fromEntries(KEYS.map(key => [key, process.env[key]]))

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined)
      delete process.env[key]
    else
      process.env[key] = saved[key]
  }
})

async function render(env: Partial<Record<typeof KEYS[number], string>>) {
  for (const key of KEYS)
    delete process.env[key]
  Object.assign(process.env, env)
  const compiled = await compileTemplate(VIEW, '/errors/tester')
  return hydrateTemplateStream(compiled, { method: 'GET' })
}

describe('errors/tester view', () => {
  it('answers 404 in production', async () => {
    expect((await render({ APP_ENV: 'production', APP_URL: 'example.com' })).status).toBe(404)
  })

  it('answers 404 for a deployment that kept APP_ENV=development but has a public URL', async () => {
    expect((await render({ APP_ENV: 'development', APP_URL: 'https://example.com' })).status).toBe(404)
  })

  it('still renders on a local machine', async () => {
    const { status, html } = await render({ APP_ENV: 'development', APP_URL: 'my-app.localhost' })
    expect(status).toBeUndefined()
    expect(html).toContain('Error Page Tester')
  })
})
