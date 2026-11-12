// The welcome mail names the application that sent it.
//
// The defect this pins: `app/Actions/SendWelcomeEmail.ts` and the job beside
// it wrote the subject as the literal 'Welcome to Stacks!'. `buddy new` copies
// this repository's `app/` into every new app, and a file under `app/` wins
// over the framework default of the same name, so every app greeted its first
// user on behalf of the framework. The default action read `config.app.name`
// the whole time; it was shadowed by the copy and never ran.
//
// So the action is resolved here the way a running server resolves it - by
// name, through `app/Events.ts` - and the subject of the mail it sends is read,
// rather than asserting on the action's source.

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { config } from '@stacksjs/config'
import { CaptureEmailDriver } from '@stacksjs/email'
import { dispatchAsync, registerAppListeners, resetListenerRegistry } from '@stacksjs/events'
import { lastEmail, mailFake, restoreMail } from '@stacksjs/testing'

const repo = resolve(import.meta.dir, '../..')
const appName = 'Zebrafish Academy'
const quiet = { warn: () => {}, error: () => {}, info: () => {} }

let root: string
let previousApp: typeof config.app

beforeAll(() => {
  previousApp = config.app
  config.app = { ...previousApp, name: appName }
  root = join(tmpdir(), `stacks-welcome-app-name-${Date.now()}`)
})

afterEach(() => {
  restoreMail()
  CaptureEmailDriver.clear()
  resetListenerRegistry()
})

afterAll(() => {
  config.app = previousApp
  rmSync(root, { recursive: true, force: true })
})

/**
 * A project whose `app/Events.ts` maps `event` onto `SendWelcomeEmail`, with
 * `actionFile` standing where the app's own action of that name would be.
 *
 * The action is re-exported rather than copied: a copy in a temp directory
 * could not resolve the framework packages it imports.
 */
function projectListeningWith(actionFile: string, event: string): string {
  const base = join(root, event.replaceAll(':', '-'))
  mkdirSync(join(base, 'app', 'Actions'), { recursive: true })
  writeFileSync(join(base, 'app', 'Events.ts'), `export default { ${JSON.stringify(event)}: ['SendWelcomeEmail'] }\n`)
  writeFileSync(join(base, 'app', 'Actions', 'SendWelcomeEmail.ts'), `export { default } from ${JSON.stringify(actionFile)}\n`)

  return base
}

describe('the welcome mail a registration sends', () => {
  const actions = {
    'the action copied into every new app': join(repo, 'app/Actions/SendWelcomeEmail.ts'),
    'the framework default behind it': join(repo, 'storage/framework/defaults/app/Actions/SendWelcomeEmail.ts'),
  }

  for (const [label, file] of Object.entries(actions)) {
    test(`is in the application's name, from ${label}`, async () => {
      const event = `welcome:app-name:${Object.keys(actions).indexOf(label)}`
      const base = projectListeningWith(file, event)

      mailFake()
      expect(await registerAppListeners({ base, log: quiet })).toBe(1)
      await dispatchAsync(event as never, { id: 1, to: 'ada@example.com', email: 'ada@example.com', name: 'Ada Lovelace' } as never)

      expect(lastEmail()?.subject).toBe(`Welcome to ${appName}!`)
    })
  }

  test('is in the application\'s name, from the job of the same name', async () => {
    const job = (await import(join(repo, 'app/Jobs/SendWelcomeEmail.ts'))).default as { handle: (_payload: unknown) => Promise<unknown> }

    mailFake()
    await job.handle({ email: 'ada@example.com', name: 'Ada Lovelace' })

    expect(lastEmail()?.subject).toBe(`Welcome to ${appName}!`)
  })
})

describe('mail an application sends out of the box', () => {
  /** Every TypeScript file under `directory`, recursively. */
  function sources(directory: string): string[] {
    let entries: string[]
    try {
      entries = readdirSync(directory)
    }
    catch {
      return []
    }

    return entries.flatMap((entry) => {
      const path = join(directory, entry)
      if (statSync(path).isDirectory())
        return sources(path)

      return path.endsWith('.ts') ? [path] : []
    })
  }

  test('never writes the framework\'s name into a subject', () => {
    // Everything an app sends mail from before its author has written a line:
    // the files `buddy new` copies, and the defaults behind them.
    const files = ['app', 'storage/framework/defaults/app'].flatMap(directory => sources(join(repo, directory)))
    expect(files.length).toBeGreaterThan(0)

    const named = files.flatMap((file) => {
      return readFileSync(file, 'utf8').split('\n')
        .map((line, index) => ({ line: line.trim(), where: `${file.slice(repo.length + 1)}:${index + 1}` }))
        // A subject written out as text. One built from `config.app.name`, with
        // the framework's name only as the fallback, names the app.
        .filter(({ line }) => /^subject:\s*['"`][^'"`]*\bStacks\b/.test(line))
        .map(({ where, line }) => `${where}  ${line}`)
    })

    expect(named).toEqual([])
  })
})
