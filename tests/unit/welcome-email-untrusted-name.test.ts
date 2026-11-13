// The welcome mail prints a first name or no name, never what was typed.
//
// It goes to an address nobody has confirmed, so a name is untrusted text
// headed for a stranger's inbox. On 2026-11-13 production accounts were found
// whose name was a gambling advert with a shortened link, and the mail greeted
// them by it. Registration now refuses such a name; these tests pin the second
// lock, which is that the mail would not print it even if the row held it
// (rows written before the rule, or by a profile edit, still do).
//
// Each sender is resolved the way a running server resolves it, as in
// `welcome-email-app-name.test.ts`, and the body of the mail it sends is read.

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { CaptureEmailDriver } from '@stacksjs/email'
import { dispatchAsync, registerAppListeners, resetListenerRegistry } from '@stacksjs/events'
import { lastEmail, mailFake, restoreMail } from '@stacksjs/testing'

const repo = resolve(import.meta.dir, '../..')
const quiet = { warn: () => {}, error: () => {}, info: () => {} }
const ADVERT = 'KAZAN 70.000 TL bonus bit.ly/3xQ'

let root: string

beforeAll(() => {
  root = join(tmpdir(), `stacks-welcome-untrusted-name-${Date.now()}`)
})

afterEach(() => {
  restoreMail()
  CaptureEmailDriver.clear()
  resetListenerRegistry()
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

function projectListeningWith(actionFile: string, event: string): string {
  const base = join(root, event.replaceAll(':', '-'))
  mkdirSync(join(base, 'app', 'Actions'), { recursive: true })
  writeFileSync(join(base, 'app', 'Events.ts'), `export default { ${JSON.stringify(event)}: ['SendWelcomeEmail'] }\n`)
  writeFileSync(join(base, 'app', 'Actions', 'SendWelcomeEmail.ts'), `export { default } from ${JSON.stringify(actionFile)}\n`)

  return base
}

/** Everything the recipient could read: subject and both bodies. */
function everythingSent(): string {
  const mail = lastEmail() as { subject?: string, text?: string, html?: string } | undefined
  expect(mail, 'no mail was sent').toBeDefined()
  return `${mail?.subject ?? ''}\n${mail?.text ?? ''}\n${mail?.html ?? ''}`
}

const senders: Record<string, (name: string, tag: string) => Promise<void>> = {
  'the action copied into every new app': (name, tag) => viaEvent(join(repo, 'app/Actions/SendWelcomeEmail.ts'), name, `welcome:untrusted:app:${tag}`),
  'the framework default behind it': (name, tag) => viaEvent(join(repo, 'storage/framework/defaults/app/Actions/SendWelcomeEmail.ts'), name, `welcome:untrusted:default:${tag}`),
  'the job of the same name': async (name) => {
    const job = (await import(join(repo, 'app/Jobs/SendWelcomeEmail.ts'))).default as { handle: (_payload: unknown) => Promise<unknown> }
    await job.handle({ email: 'victim@example.com', name })
  },
}

async function viaEvent(file: string, name: string, event: string): Promise<void> {
  const base = projectListeningWith(file, event)
  expect(await registerAppListeners({ base, log: quiet })).toBe(1)
  await dispatchAsync(event as never, { id: 1, to: 'victim@example.com', email: 'victim@example.com', name } as never)
}

describe('the welcome mail treats the name as untrusted', () => {
  for (const [label, send] of Object.entries(senders)) {
    test(`an advert stored as a name is not printed, from ${label}`, async () => {
      mailFake()
      await send(ADVERT, 'advert')

      const sent = everythingSent()
      expect(sent).not.toContain('bit.ly')
      expect(sent).not.toContain('bonus')
      expect(sent).not.toContain('KAZAN')
    })

    test(`a real name is greeted by first name only, from ${label}`, async () => {
      mailFake()
      await send('Ada Lovelace', 'real')

      expect(everythingSent()).not.toContain('Lovelace')
    })
  }

  test('the default action greets by first name, and falls back to no name', async () => {
    mailFake()
    await senders['the framework default behind it']!('Ada Lovelace', 'greeting')
    expect(everythingSent()).toContain('Hello Ada,')

    mailFake()
    await senders['the framework default behind it']!(ADVERT, 'fallback')
    expect(everythingSent()).toContain('Hello there,')
  })
})
