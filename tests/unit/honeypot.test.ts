// The honeypot: a middleware any route can carry, and the form helper that
// feeds it.
//
// A bot fills every input, including one no person can see, and submits in
// well under the time it takes to read a form. The middleware refuses both and
// lets through any client that sends neither field, so it can sit on a route
// (it sits on POST /register) without breaking API clients or older forms.

import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from '@stacksjs/config'
import Honeypot from '../../storage/framework/defaults/app/Middleware/Honeypot'
import { createHoneypot } from '../../storage/framework/defaults/functions/honeypot'

const repo = resolve(import.meta.dir, '../..')
const originalForms = (config as { forms?: unknown }).forms

afterEach(() => {
  ;(config as { forms?: unknown }).forms = originalForms
})

function request(body: Record<string, unknown>): any {
  return { all: () => ({ ...body }), get: (key: string) => body[key] }
}

async function statusOf(body: Record<string, unknown>): Promise<number> {
  try {
    await Honeypot.handle(request(body))
    return 200
  }
  catch (error) {
    return Number((error as { status?: number, statusCode?: number }).status ?? (error as { statusCode?: number }).statusCode ?? 500)
  }
}

describe('the honeypot middleware', () => {
  test('passes a request that sends neither field', async () => {
    expect(await statusOf({ email: 'ada@example.com', name: 'Ada Lovelace' })).toBe(200)
  })

  test('passes a person: empty trap, a believable time on the form', async () => {
    expect(await statusOf({ _hp: '', _renderedMs: 14_000 })).toBe(200)
    expect(await statusOf({ _hp: '   ', _renderedMs: '14000' })).toBe(200)
  })

  test('refuses a filled trap', async () => {
    expect(await statusOf({ _hp: 'https://example.com', _renderedMs: 14_000 })).toBe(422)
  })

  test('refuses a form sent faster than a person could fill it', async () => {
    expect(await statusOf({ _hp: '', _renderedMs: 400 })).toBe(429)
  })

  test('follows config.forms.spam', async () => {
    ;(config as { forms?: unknown }).forms = { spam: { honeypot: false, minSubmitSeconds: 0 } }

    expect(await statusOf({ _hp: 'filled', _renderedMs: 1 })).toBe(200)
  })

  test('reads a request that only has get()', async () => {
    const body: Record<string, unknown> = { _hp: 'filled' }
    let status = 200
    try {
      await Honeypot.handle({ get: (key: string) => body[key] } as never)
    }
    catch (error) {
      status = Number((error as { status?: number, statusCode?: number }).status ?? (error as { statusCode?: number }).statusCode)
    }
    expect(status).toBe(422)
  })
})

describe('createHoneypot', () => {
  test('reports the trap value and the time the form was open', () => {
    let now = 1_000
    const honeypot = createHoneypot(() => now)

    now = 9_500
    expect(honeypot.fields()).toEqual({ _hp: '', _renderedMs: 8_500 })

    honeypot.set('I am a bot')
    expect(honeypot.fields()._hp).toBe('I am a bot')

    honeypot.set(undefined)
    expect(honeypot.fields()._hp).toBe('')
  })

  test('never reports a negative time', () => {
    let now = 5_000
    const honeypot = createHoneypot(() => now)
    now = 4_000
    expect(honeypot.fields()._renderedMs).toBe(0)
  })
})

describe('where the honeypot is wired', () => {
  const read = (file: string): string => readFileSync(resolve(repo, file), 'utf8')

  test('POST /register carries the middleware', () => {
    expect(read('storage/framework/defaults/routes/auth.ts')).toMatch(/route\.post\('\/register', 'Actions\/Auth\/RegisterAction'\)\.middleware\('honeypot'\)/)
  })

  test('the alias is registered for apps and for the defaults', () => {
    for (const file of ['app/Middleware.ts', 'storage/framework/defaults/app/Middleware.ts'])
      expect(read(file)).toContain(`'honeypot': 'Honeypot'`)
  })

  test('the sign-up form has the hidden input and sends its fields', () => {
    const form = read('storage/framework/defaults/resources/components/Dashboard/Auth/Register.stx')
    expect(form).toMatch(/<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden" @input="honeypot\.set\(\$event\.target\.value\)">/)
    expect(form).toContain('...honeypot.fields()')
  })
})
