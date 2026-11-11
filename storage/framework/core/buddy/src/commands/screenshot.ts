import type { CLI } from '@stacksjs/types'
import { mkdirSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import process from 'node:process'

// A picture of a page, as a command.
//
// Looking at what a change did is the step that gets skipped, because the
// honest way to do it has been a browser somebody has to have installed, a
// driver for it, and a script written for the occasion. Bun carries a browser
// view of its own (`Bun.WebView`): the system's WebKit on a Mac, an installed
// Chrome elsewhere. `buddy screenshot <url>` is that view pointed at a page:
// load it, let it settle, photograph it at each size asked for.
//
// It photographs one page. Journeys - click this, then that - belong in
// `@stacksjs/testing/browser`, which keeps a browser open across steps. What
// this adds to a bare screenshot is the handful of things that make one
// trustworthy: a settle time and a selector to wait for (a page photographed
// before its data arrives is a picture of a spinner), several viewports in one
// run (a layout is only checked when its phone and desktop are both looked
// at), and a kept profile, so a page behind a sign-in can be photographed
// after signing in once with `--eval`.
//
// Line comments rather than block comments inside function bodies, as in
// simulator.ts.

export interface Viewport {
  name: string
  width: number
  height: number
}

// The sizes worth checking by name: a current phone, a tablet in portrait and
// a laptop. Anything else is given as WIDTHxHEIGHT.
export const VIEWPORTS: Record<string, Omit<Viewport, 'name'>> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
}

/**
 * `mobile,tablet,1280x720` as viewports, in the order given and without
 * repeats. Throws on a name it does not know or a size outside what a view can
 * be, rather than photographing something else quietly.
 */
export function parseViewports(value: string | undefined): Viewport[] {
  const parts = String(value || 'desktop').split(',').map(part => part.trim().toLowerCase()).filter(Boolean)
  const seen = new Set<string>()
  const viewports: Viewport[] = []

  for (const part of parts.length > 0 ? parts : ['desktop']) {
    const named = VIEWPORTS[part]
    const sized = /^(\d{2,5})x(\d{2,5})$/.exec(part)

    if (!named && !sized)
      throw new Error(`Unknown viewport "${part}". Use ${Object.keys(VIEWPORTS).join(', ')} or WIDTHxHEIGHT.`)

    const viewport = named
      ? { name: part, ...named }
      : { name: part, width: Number(sized![1]), height: Number(sized![2]) }

    if (viewport.width < 200 || viewport.width > 7680 || viewport.height < 200 || viewport.height > 7680)
      throw new Error(`Viewport ${part} is outside 200 to 7680 pixels a side.`)

    if (seen.has(viewport.name))
      continue

    seen.add(viewport.name)
    viewports.push(viewport)
  }

  return viewports
}

/**
 * Where one viewport's picture goes. A single viewport is the path as given;
 * several put the viewport's name before the extension (`home.png` becomes
 * `home-mobile.png`), so one run never overwrites its own pictures.
 */
export function screenshotPath(out: string | undefined, viewport: Viewport, many: boolean): string {
  const wanted = String(out || 'screenshot.png')
  const extension = extname(wanted)
  const base = extension ? wanted.slice(0, -extension.length) : wanted
  const suffix = extension.toLowerCase() === '.png' ? extension : '.png'

  return resolve(many ? `${base}-${viewport.name}${suffix}` : `${base}${suffix}`)
}

/** `localhost:3000/pricing` is a page too; anything that is not http(s) is a scheme, not a page. */
export function pageUrl(value: string): string | null {
  const text = String(value || '').trim()
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : /^(?:localhost|127\.0\.0\.1|\[::1\]|[\w-]+(?:\.[\w-]+)+)(?::\d+)?(?:[/?#]|$)/i.test(text) ? `http://${text}` : ''

  try {
    const url = new URL(candidate)

    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  }
  catch {
    return null
  }
}

/** A count of milliseconds from an option, within bounds; the fallback when it is not a number. */
export function boundedMs(value: unknown, fallback: number, max = 120_000): number {
  const ms = Number(value)

  return Number.isFinite(ms) && ms >= 0 ? Math.min(max, Math.round(ms)) : fallback
}

interface ScreenshotOptions {
  out?: string
  viewport?: string
  wait?: number | string
  waitFor?: string
  timeout?: number | string
  scroll?: number | string
  eval?: string
  profile?: string
  backend?: string
}

interface PageView {
  navigate: (url: string) => Promise<unknown>
  evaluate: (script: string) => Promise<unknown>
  screenshot: () => Promise<Uint8Array | ArrayBuffer | Blob>
  resize?: (width: number, height: number) => Promise<unknown> | unknown
  close?: () => Promise<unknown> | unknown
}

// eslint-disable-next-line pickier/no-unused-vars
type PageViewConstructor = new (options: Record<string, unknown>) => PageView

/** Bun's own browser view, or null on a Bun that predates it. */
function pageView(): PageViewConstructor | null {
  const view = (Bun as unknown as { WebView?: PageViewConstructor }).WebView

  return typeof view === 'function' ? view : null
}

async function photograph(View: PageViewConstructor, url: string, viewport: Viewport, path: string, options: ScreenshotOptions): Promise<void> {
  // The system's WebKit on a Mac needs nothing installed; elsewhere Bun drives
  // an installed Chrome. `--backend` says so explicitly when the default is not
  // the one wanted.
  const backend = options.backend || (process.platform === 'darwin' ? 'webkit' : 'chrome')
  const view = new View({
    width: viewport.width,
    height: viewport.height,
    backend,
    ...(options.profile ? { dataStore: { directory: resolve(options.profile) } } : {}),
  })

  try {
    await view.navigate(url)

    const timeout = boundedMs(options.timeout, 15_000)
    const selector = String(options.waitFor || '')

    if (selector) {
      // Polled in the page rather than with a fixed sleep: the page says when
      // it is ready, and a timeout says so instead of photographing a spinner.
      const found = await view.evaluate(`(async () => { const until = Date.now() + ${timeout}; while (Date.now() < until) { if (document.querySelector(${JSON.stringify(selector)})) return true; await new Promise(done => setTimeout(done, 100)) } return false })()`)

      if (found !== true)
        throw new Error(`Nothing matched ${selector} within ${Math.round(timeout / 1000)}s.`)
    }

    await Bun.sleep(boundedMs(options.wait, 1500))

    if (options.eval) {
      const result = await view.evaluate(options.eval)

      if (result !== undefined && result !== null)
        console.log(typeof result === 'string' ? result : JSON.stringify(result))
    }

    const scroll = Number(options.scroll)

    if (Number.isFinite(scroll) && scroll > 0) {
      await view.evaluate(`window.scrollTo(0, ${Math.round(scroll)})`)
      await Bun.sleep(400)
    }

    const picture = await view.screenshot()

    mkdirSync(dirname(path), { recursive: true })
    await Bun.write(path, picture as Uint8Array)
  }
  finally {
    await view.close?.()
  }
}

export function screenshot(buddy: CLI): void {
  buddy
    .command('screenshot <url>', 'Photograph a page at one or more viewport sizes, with Bun\'s own browser view')
    .option('--out <path>', 'Where the PNG goes. With several viewports, each name is added before the extension.', { default: 'screenshot.png' })
    .option('--viewport <list>', 'mobile, tablet, desktop or WIDTHxHEIGHT, comma-separated', { default: 'desktop' })
    .option('--wait <ms>', 'How long to let the page settle after it loads', { default: 1500 })
    .option('--wait-for <selector>', 'Wait until this CSS selector matches before photographing', { default: '' })
    .option('--timeout <ms>', 'How long --wait-for may take', { default: 15000 })
    .option('--scroll <pixels>', 'Scroll down this far before photographing', { default: 0 })
    .option('--eval <script>', 'Run this in the page before photographing, and print what it returns', { default: '' })
    .option('--profile <directory>', 'Keep cookies and storage here between runs, so a signed-in page can be photographed', { default: '' })
    .option('--backend <name>', 'webkit or chrome. Defaults to webkit on a Mac and chrome elsewhere.', { default: '' })
    .example('buddy screenshot localhost:3000 --viewport mobile,desktop --out storage/screenshots/home.png')
    .example('buddy screenshot https://example.com/pricing --wait-for main --wait 500')
    .action(async (target: string, options: ScreenshotOptions) => {
      const url = pageUrl(target)

      // Refused rather than handed on, as `simulator:open` does: a tool that
      // loads arbitrary schemes on request is a wider thing than a camera.
      if (!url) {
        console.error('  Only http and https pages. Anything else is a scheme, not a page.')
        process.exit(1)
        return
      }

      const View = pageView()

      if (!View) {
        console.error(`  This Bun (${Bun.version}) has no browser view. \`buddy upgrade:bun\` gets one that does.`)
        process.exit(1)
        return
      }

      let viewports: Viewport[]

      try {
        viewports = parseViewports(options.viewport)
      }
      catch (error) {
        console.error(`  ${(error as Error).message}`)
        process.exit(1)
        return
      }

      for (const viewport of viewports) {
        const path = screenshotPath(options.out, viewport, viewports.length > 1)

        try {
          await photograph(View, url, viewport, path, options)
        }
        catch (error) {
          console.error(`  could not photograph ${url} at ${viewport.width}x${viewport.height}: ${(error as Error).message}`)

          if (process.platform !== 'darwin' && !options.backend)
            console.error('  Off a Mac this needs an installed Chrome.')

          process.exit(1)
          return
        }

        console.error(`  ${viewport.name.padEnd(9)} ${viewport.width}x${viewport.height}  ${path}`)
      }
    })
}
