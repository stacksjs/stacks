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
import { FRAMEWORK_ONLY_PATHS } from '../src/scaffold-package-app'
import { APP_SITE_TEMPLATE, APP_TOP_LEVEL, REMOVED_BY_OTHER_STEPS, SITE_ONLY_PATHS, applyAppSiteTemplate } from '../src/scaffold-site'

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
  for (const dir of ['resources', 'public', 'docs', 'content', 'ops', '.reviewos', APP_SITE_TEMPLATE])
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

  test('the starter names the app from its own config', () => {
    // In the head partial every page shares, so a second page gets it too.
    const head = readFileSync(join(app, 'resources/partials/head.stx'), 'utf8')

    expect(head).toContain('config.app.name')
    expect(head).toContain('config.app.url')
    expect(head).toContain('rel="canonical" href="{{ canonicalUrl }}"')
    expect(head).not.toContain('application/ld+json')
  })

  test('the starter page is a page in a layout, not a whole document', () => {
    // Every app used to start from one `@nolayout` page and a layout that was
    // three `@yield` lines, so there was no example of a document shell.
    const index = readFileSync(join(app, 'resources/views/index.stx'), 'utf8')
    const layout = readFileSync(join(app, 'resources/views/layouts/default.stx'), 'utf8')

    expect(index.startsWith('@extends(\'default\')')).toBe(true)
    expect(index).toContain('@section(\'content\')')
    expect(index).not.toContain('@nolayout')
    expect(index).not.toContain('<html')

    expect(layout).toContain('<!DOCTYPE html>')
    expect(layout).toContain('@include(\'head\')')
    expect(layout).toContain('href="#main"')
    expect(layout).toContain('<main id="main"')
    expect(layout).toContain('@yield(\'content\')')
  })

  test('every component the starter uses is one it ships', () => {
    const tags = walk(join(app, 'resources/views'))
      .flatMap(file => [...readFileSync(file, 'utf8').matchAll(/<([A-Z][A-Za-z]+)[\s/>]/g)].map(match => match[1]))

    expect(tags.length).toBeGreaterThan(0)
    for (const tag of new Set(tags))
      expect(existsSync(join(app, `resources/components/${tag}.stx`))).toBe(true)
  })

  test('no starter comment names a directive', () => {
    // stx reads directives inside `{{-- --}}` comments. A layout whose comment
    // spelled out its own extends line extended itself, and the first request
    // for `/` took the dev server to 150% CPU for good.
    const offenders = walk(join(REPO, APP_SITE_TEMPLATE))
      .filter(file => file.endsWith('.stx'))
      .filter(file => [...readFileSync(file, 'utf8').matchAll(/\{\{--[\s\S]*?--\}\}/g)]
        .some(comment => /@(?:extends|section|endsection|include|yield|push|stack|layout|nolayout|if|foreach)\b/.test(comment[0])))
      .map(file => relative(join(REPO, APP_SITE_TEMPLATE), file))

    expect(offenders).toEqual([])
  })

  test('every directory config/ui.ts points stx at exists', () => {
    // stx warns once per configured directory that is missing. `config/ui.ts`
    // said `layoutsDir: 'layouts'`, which is `resources/layouts`: the folder
    // that holds only the desktop demo's layout and is gone from an app, while
    // the dev and production servers scan `resources/views/layouts`. Stripping
    // the demo emptied `resources/components` and `resources/partials` too, so
    // a new app's first `./buddy dev` opened on three warnings.
    const ui = readFileSync(join(REPO, 'config/ui.ts'), 'utf8')
    const value = (key: string): string => {
      const found = new RegExp(`^  ${key}: '([^']+)',$`, 'm').exec(ui)?.[1]
      if (!found)
        throw new Error(`config/ui.ts sets no ${key}`)
      return found
    }

    const root = value('root')
    const missing = ['componentsDir', 'layoutsDir', 'partialsDir']
      .map(key => `${key}: ${join(root, value(key))}`)
      .filter(entry => !existsSync(join(app, entry.slice(entry.indexOf(': ') + 2))))

    expect(missing).toEqual([])
    // The same folder the servers pass to stx (`dev/views.ts`, `production-server.ts`).
    expect(join(root, value('layoutsDir'))).toBe('resources/views/layouts')
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

describe('the template\'s top level', () => {
  test('every committed path is kept on purpose or removed by a named step', () => {
    // `ops/production` (the stacksjs.com host's backup operators) and
    // `.reviewos/` (the framework's release gate) shipped in every new app,
    // found scaffolding cursio: nothing listed what an app is meant to keep.
    const listed = Bun.spawnSync(['git', 'ls-tree', '--name-only', 'HEAD'], { cwd: REPO, stdout: 'pipe', stderr: 'pipe' })
    // A tarball of the repository has no history to ask.
    if (listed.exitCode !== 0)
      return

    const removed = new Set<string>([
      ...SITE_ONLY_PATHS,
      ...FRAMEWORK_ONLY_PATHS,
      ...Object.keys(REMOVED_BY_OTHER_STEPS),
    ])
    const unaccounted = listed.stdout.toString().split('\n')
      .filter(entry => entry.length > 0)
      .filter(entry => !APP_TOP_LEVEL.includes(entry) && !removed.has(entry))
      // `content/` is listed by what is in it and goes once that is gone.
      .filter(entry => !SITE_ONLY_PATHS.some(path => path.startsWith(`${entry}/`)) || APP_TOP_LEVEL.includes(entry))

    expect(unaccounted).toEqual([])
  })

  test('nothing is both kept and removed', () => {
    const removed = new Set<string>([...SITE_ONLY_PATHS, ...FRAMEWORK_ONLY_PATHS, ...Object.keys(REMOVED_BY_OTHER_STEPS)])

    expect(APP_TOP_LEVEL.filter(entry => removed.has(entry))).toEqual([])
  })

  test('the steps named for the other removals are in buddy new', () => {
    const source = readFileSync(CREATE_COMMAND, 'utf8')
    const missing = Object.entries(REMOVED_BY_OTHER_STEPS)
      .filter(([, step]) => !source.includes(`${step}(`))
      .map(([path, step]) => `${path}: ${step}`)

    expect(missing).toEqual([])
  })

  test('the framework host\'s operations and release gate do not ship', () => {
    expect(existsSync(join(app, 'ops'))).toBe(false)
    expect(existsSync(join(app, '.reviewos'))).toBe(false)
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
      .toBeLessThan(source.indexOf('await unvendorCore(path, options'))
  })
})
