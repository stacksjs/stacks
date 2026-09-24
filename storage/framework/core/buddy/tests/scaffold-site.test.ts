// What a generated app inherits as its website.
//
// `buddy new` scaffolds by downloading this repository, and this repository is
// stacksjs.com. Until `applyAppSiteTemplate`, every new app shipped the
// marketing homepage with `siteUrl = 'https://stacksjs.com'`, an Organization
// JSON-LD graph for Stacks, the NPS brand fonts, the park illustrations and a
// desktop-OS demo. Found scaffolding marioadrion, where all of it had to be
// deleted by hand.
//
// These tests run the real function against a copy of the repository's real
// `resources/`, `public/`, `docs/` and `content/`, so a page added to stacksjs.com later without a
// matching `SITE_ONLY_PATHS` entry fails here rather than in someone's deploy.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { APP_SITE_TEMPLATE, SITE_ONLY_PATHS, applyAppSiteTemplate } from '../src/scaffold-site'

const REPO = join(import.meta.dir, '../../../../..')
const CREATE_COMMAND = join(import.meta.dir, '../src/commands/create.ts')

const PAGE_SOURCE = /\.(?:stx|html|ts|js|css)$/
const BRAND_FONT = /NPS|Sequoia|Switchback|Redwood|Campmate/

function walk(dir: string): string[] {
  if (!existsSync(dir))
    return []

  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

let app: string
let removed: string[]

beforeAll(() => {
  app = mkdtempSync(join(tmpdir(), 'stacks-scaffold-site-'))
  for (const dir of ['resources', 'public', 'docs', 'content', APP_SITE_TEMPLATE])
    cpSync(join(REPO, dir), join(app, dir), { recursive: true })

  removed = applyAppSiteTemplate(app)
})

afterAll(() => {
  rmSync(app, { recursive: true, force: true })
})

describe('a scaffolded app does not inherit stacksjs.com', () => {
  test('no page claims to be stacksjs.com', () => {
    // A link to the docs is fine. A canonical URL, an og:url, a JSON-LD @id or
    // a `siteUrl` constant naming stacksjs.com is the app impersonating it.
    const offenders = walk(join(app, 'resources'))
      .concat(walk(join(app, 'public')))
      .filter(file => PAGE_SOURCE.test(file))
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
          .replace(/<a\b[^>]*\bhref="https:\/\/stacksjs\.com[^"]*"/g, '')
        return source.includes('stacksjs.com')
      })
      .map(file => relative(app, file))

    expect(offenders).toEqual([])
  })

  test('no Stacks Organization structured data', () => {
    const offenders = walk(join(app, 'resources'))
      .filter(file => PAGE_SOURCE.test(file))
      .filter(file => /'@type':\s*'Organization'/.test(readFileSync(file, 'utf8')))
      .map(file => relative(app, file))

    expect(offenders).toEqual([])
  })

  test('none of the brand fonts', () => {
    expect(existsSync(join(app, 'resources/assets/fonts/nps'))).toBe(false)
    expect(existsSync(join(app, 'public/assets/fonts/nps'))).toBe(false)

    const fonts = walk(app)
      .map(file => relative(app, file))
      .filter(file => !file.startsWith(APP_SITE_TEMPLATE) && BRAND_FONT.test(file))

    expect(fonts).toEqual([])
  })

  test('none of the park illustrations or the desktop demo', () => {
    const leftovers = walk(join(app, 'resources'))
      .concat(walk(join(app, 'public')))
      .map(file => relative(app, file))
      .filter(file => /park-|topography|wood-sign|Taskbar|StartMenu|Desktop/.test(file))

    expect(leftovers).toEqual([])
  })

  test('the starter page names the app from its own config', () => {
    const index = readFileSync(join(app, 'resources/views/index.stx'), 'utf8')

    expect(index).toContain('config.app.name')
    expect(index).toContain('config.app.url')
    expect(index).toContain('rel="canonical" href="{{ canonicalUrl }}"')
    expect(index).not.toContain('application/ld+json')
  })

  test('what the app needs survives', () => {
    // The native build resolves the app icon from the project only, with no
    // fallback to the defaults tree.
    expect(existsSync(join(app, 'resources/assets/images/app-icon.png'))).toBe(true)
    expect(existsSync(join(app, 'resources/functions/dark.ts'))).toBe(true)
    expect(existsSync(join(app, 'resources/emails/Welcome.stx'))).toBe(true)
    expect(existsSync(join(app, 'resources/assets/styles/docs/main.css'))).toBe(true)
  })

  test('neither the framework docs nor the Stacks blog posts', () => {
    // `buddy deploy` builds both when they exist, so an app published them.
    expect(existsSync(join(app, 'docs'))).toBe(false)
    expect(existsSync(join(app, 'content'))).toBe(false)
  })

  test('none of the Stacks logos, but the images framework pages use', () => {
    expect(existsSync(join(app, 'public/images/logos/logo.svg'))).toBe(false)
    expect(existsSync(join(app, 'public/images/og-image.png'))).toBe(false)

    // The dashboard layouts link these favicons, and the Marketing components
    // in the defaults tree use the rest.
    for (const kept of [
      'public/images/logos/favicon.svg',
      'public/images/logos/favicon-dark.svg',
      'public/images/avatars/avatar-1.png',
      'public/images/background-faqs.jpg',
      'public/images/screenshots/dashboard.png',
    ])
      expect(existsSync(join(app, kept))).toBe(true)
  })

  test('emptied directories go with their contents', () => {
    expect(existsSync(join(app, 'resources/data'))).toBe(false)
    expect(existsSync(join(app, 'public/assets'))).toBe(false)
  })

  test('running it twice is harmless', () => {
    // The only listed path left is the starter's own index.stx, which is
    // removed and laid down again.
    expect(applyAppSiteTemplate(app)).toEqual(['resources/views/index.stx'])
    expect(readFileSync(join(app, 'resources/views/index.stx'), 'utf8')).toContain('config.app.name')
  })
})

describe('the site-only list', () => {
  test('names only paths the template actually has', () => {
    // A stale entry is harmless to scaffolding but means the list no longer
    // describes the site, which is the list's whole job.
    const missing = SITE_ONLY_PATHS.filter(path => !existsSync(join(REPO, path)))

    expect(missing).toEqual([])
    expect(removed.length).toBe(SITE_ONLY_PATHS.length)
  })

  test('leaves the repository itself serving stacksjs.com', () => {
    // It runs on the download, never on this checkout.
    expect(readFileSync(join(REPO, 'resources/views/index.stx'), 'utf8'))
      .toContain('https://stacksjs.com')
  })
})

describe('buddy new wiring', () => {
  const source = readFileSync(CREATE_COMMAND, 'utf8')

  test('the replacement runs', () => {
    expect(source).toContain('replaceFrameworkSite(path)')
  })

  test('it runs before the framework is unvendored', () => {
    // The starter lives under `storage/framework/defaults`, which unvendoring
    // deletes.
    expect(source.indexOf('replaceFrameworkSite(path)'))
      .toBeLessThan(source.indexOf('await unvendorCore(path, options)'))
  })
})
