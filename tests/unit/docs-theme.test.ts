import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The docs theme (docs/.theme.css, loaded by config/docs.ts) is held to the
 * same Lighthouse bar as the marketing pages. Each check below is a way it
 * fell short once: a favicon path with no file (a 404 in every page's
 * console), a tertiary grey under 4.5:1, and Geist from a Google Fonts
 * stylesheet, a render-blocking request to another origin.
 */

const root = join(import.meta.dir, '..', '..')
const theme = readFileSync(join(root, 'docs/.theme.css'), 'utf8')
const config = readFileSync(join(root, 'config/docs.ts'), 'utf8')

function luminance(hex: string): number {
  const [r, g, b] = hex.replace('#', '').match(/\w\w/g)!.map(part => Number.parseInt(part, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light! + 0.05) / (dark! + 0.05)
}

/** The value of `name` in the first rule that starts with `selector`. */
function token(selector: string, name: string): string {
  const block = theme.slice(theme.indexOf(`${selector} {`))
  const value = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(block)?.[1]
  if (!value)
    throw new Error(`${name} not found under ${selector}`)
  return value
}

describe('the docs theme', () => {
  it('links only to files the docs site serves', () => {
    for (const [, href] of config.matchAll(/href:\s*'(\/[^']+)'/g))
      expect(existsSync(join(root, 'docs/public', href!))).toBe(true)
  })

  it('serves Geist itself, from the files the main site already caches', () => {
    expect(config).not.toContain('fonts.googleapis')
    expect(config).not.toMatch(/google:\s*\[/)
    const urls = [...theme.matchAll(/url\("(\/assets\/fonts\/[^"]+)"\)/g)].map(match => match[1]!)
    expect(urls.length).toBeGreaterThanOrEqual(2)
    for (const url of urls)
      expect(existsSync(join(root, 'public', url))).toBe(true)
  })

  it('keeps tertiary text at 4.5:1 or better on every background, in both themes', () => {
    const light = token(':root', '--bp-c-text-3')
    for (const name of ['--bp-c-bg', '--bp-c-bg-alt', '--bp-c-bg-soft'])
      expect(contrast(light, token(':root', name))).toBeGreaterThanOrEqual(4.5)

    const dark = token('html.dark', '--bp-c-text-3')
    for (const name of ['--bp-c-bg', '--bp-c-bg-alt', '--bp-c-bg-soft'])
      expect(contrast(dark, token('html.dark', name))).toBeGreaterThanOrEqual(4.5)
  })

  it('never hides the title text from screen readers, since the logo has no alt text', () => {
    const rule = /\.BPNavBarTitle-text\s*\{([^}]*)\}/.exec(theme)?.[1] ?? ''
    expect(rule).not.toContain('display: none')
    expect(rule).not.toContain('visibility: hidden')
  })
})
