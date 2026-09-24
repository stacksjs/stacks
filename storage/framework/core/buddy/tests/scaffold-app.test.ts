// What a generated app is called.
//
// `buddy new` copies this repository's `.env.example` to the app's `.env`, and
// that file named the app Stacks: `APP_NAME=Stacks`, `APP_URL=stacks.localhost`,
// a `stacks` database and mail from `no-reply@stacksjs.com`. The starter page,
// the maintenance page and the mail sender name all read those, so a new app
// introduced itself as the framework until someone edited `.env` by hand.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appEnvValues, appIdentity, applyAppEnvTemplate, renderTemplate } from '../src/scaffold-app'

const REPO = join(import.meta.dir, '../../../../..')
const CREATE_COMMAND = join(import.meta.dir, '../src/commands/create.ts')

describe('appIdentity', () => {
  test('derives every spelling from the directory name', () => {
    expect(appIdentity('/Users/me/Code/my-app')).toEqual({
      slug: 'my-app',
      displayName: 'My App',
      kebab: 'my-app',
      snake: 'my_app',
      bundleId: 'com.example.my-app',
    })
  })

  test('keeps hostnames and tags valid whatever the directory is called', () => {
    // A custom-element tag and a hostname label must start with a letter and
    // hold only lowercase letters, digits and hyphens.
    const identity = appIdentity('/tmp/2026_Launch.Site/')

    expect(identity.slug).toBe('2026_Launch.Site')
    expect(identity.displayName).toBe('2026 Launch Site')
    expect(identity.kebab).toBe('launch-site')
    expect(identity.snake).toBe('launch_site')
  })

  test('renders every placeholder', () => {
    const rendered = renderTemplate('__APP_NAME__|__APP_SLUG__|__APP_TAG_PREFIX__|__APP_BUNDLE_ID__', appIdentity('/tmp/acme-shop'))
    expect(rendered).toBe('Acme Shop|acme-shop|acme-shop|com.example.acme-shop')
  })
})

describe('the app .env.example', () => {
  let app: string
  let original: string
  let rendered: string
  let changed: string[]

  beforeAll(() => {
    app = mkdtempSync(join(tmpdir(), 'stacks-scaffold-env-'))
    copyFileSync(join(REPO, '.env.example'), join(app, '.env.example'))
    original = readFileSync(join(app, '.env.example'), 'utf8')
    changed = applyAppEnvTemplate(app, appIdentity('/tmp/mario-adrion'))
    rendered = readFileSync(join(app, '.env.example'), 'utf8')
  })

  afterAll(() => {
    rmSync(app, { recursive: true, force: true })
  })

  test('names the app, not Stacks', () => {
    expect(rendered).toContain('APP_NAME="Mario Adrion"\n')
    expect(rendered).toContain('APP_URL=mario-adrion.localhost\n')
    expect(rendered).toContain('DB_DATABASE=mario_adrion\n')
    expect(rendered).toContain('QUEUE_PREFIX=mario_adrion:queue\n')
    expect(rendered).not.toContain('stacksjs.com')
    expect(rendered).not.toMatch(/^APP_NAME=Stacks$/m)
  })

  test('drops what only the stacks box uses', () => {
    expect(rendered).not.toContain('PREDICTHQ')
  })

  test('touches nothing else', () => {
    // Every key it knows about is in the real file, so a rename upstream shows
    // up here rather than as a value that silently stops being rewritten.
    expect(changed.sort()).toEqual(Object.keys(appEnvValues(appIdentity('/tmp/x'))).sort())

    const untouched = (text: string) => text.split('\n')
      .filter(line => !Object.keys(appEnvValues(appIdentity('/tmp/x'))).some(key => line.startsWith(`${key}=`)))
    expect(untouched(rendered)).toEqual(untouched(original))
  })
})

describe('buddy new wiring', () => {
  const source = readFileSync(CREATE_COMMAND, 'utf8')

  test('names the app before .env is copied from the example', () => {
    expect(source).toContain('applyAppEnv(path)')
    expect(source.indexOf('applyAppEnv(path)'))
      .toBeLessThan(source.indexOf('await install(path, options)'))
  })
})
