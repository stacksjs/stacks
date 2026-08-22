import { describe, expect, test } from 'bun:test'
import { ERROR_ILLUSTRATIONS, errorIllustration, illustrationForStatus } from '../src/error-illustrations'
import { HTTP_ERRORS, renderProductionErrorPage } from '../src/error-page'

const NAMES = ['403', '404', '500', '503'] as const

describe('illustrationForStatus', () => {
  test('every status in HTTP_ERRORS resolves to one of the four scenes', () => {
    const statuses = Object.keys(HTTP_ERRORS).map(Number)
    expect(statuses.length).toBeGreaterThan(0)

    for (const status of statuses)
      expect(NAMES).toContain(illustrationForStatus(status))
  })

  test('groups statuses by what the page is telling the visitor', () => {
    // "You may not pass"
    expect(illustrationForStatus(401)).toBe('403')
    expect(illustrationForStatus(403)).toBe('403')

    // "There is nothing out here"
    expect(illustrationForStatus(404)).toBe('404')
    expect(illustrationForStatus(405)).toBe('404')
    expect(illustrationForStatus(410)).toBe('404')

    // "Come back later"
    expect(illustrationForStatus(408)).toBe('503')
    expect(illustrationForStatus(429)).toBe('503')
    expect(illustrationForStatus(502)).toBe('503')
    expect(illustrationForStatus(503)).toBe('503')
    expect(illustrationForStatus(504)).toBe('503')

    // "Something went wrong out here"
    expect(illustrationForStatus(400)).toBe('500')
    expect(illustrationForStatus(409)).toBe('500')
    expect(illustrationForStatus(422)).toBe('500')
    expect(illustrationForStatus(500)).toBe('500')
  })

  test('falls back by status class for anything outside HTTP_ERRORS', () => {
    expect(illustrationForStatus(418)).toBe('404')
    expect(illustrationForStatus(451)).toBe('404')
    expect(illustrationForStatus(507)).toBe('500')
    expect(illustrationForStatus(599)).toBe('500')
  })
})

describe('ERROR_ILLUSTRATIONS', () => {
  test('each one is a complete, self-contained SVG element', () => {
    for (const name of NAMES) {
      const svg = ERROR_ILLUSTRATIONS[name]
      expect(svg.startsWith('<svg ')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
      // A scene that fetches anything is a scene that can fail to paint on
      // the one page guaranteed to be served while something is broken. Every
      // reference it makes has to be a fragment pointing back into itself.
      expect(svg).not.toContain('<image')
      const refs = [...svg.matchAll(/(?:xlink:)?href="([^"]*)"/gi)].map(m => m[1]!)
      expect(refs.length).toBeGreaterThan(0)
      for (const ref of refs)
        expect(ref.startsWith('#')).toBe(true)
    }
  })

  test('each one is fitted and hidden from assistive tech', () => {
    for (const name of NAMES) {
      const svg = ERROR_ILLUSTRATIONS[name]
      expect(svg).toContain('aria-hidden="true"')
      expect(svg).toContain('preserveAspectRatio="xMidYMid slice"')
    }
  })

  test('errorIllustration returns the markup for the mapped scene', () => {
    expect(errorIllustration(429)).toBe(ERROR_ILLUSTRATIONS['503'])
    expect(errorIllustration(404)).toBe(ERROR_ILLUSTRATIONS['404'])
  })
})

describe('renderProductionErrorPage illustration', () => {
  test('inlines exactly one scene, chosen for the status', () => {
    const html = renderProductionErrorPage(401)

    expect(html).toContain(ERROR_ILLUSTRATIONS['403'])
    expect(html).not.toContain(ERROR_ILLUSTRATIONS['404'])
    expect(html.split('</svg>').length - 1).toBe(1)
  })

  test('every status in HTTP_ERRORS renders its scene and its copy', () => {
    for (const [key, info] of Object.entries(HTTP_ERRORS)) {
      const status = Number(key)
      const html = renderProductionErrorPage(status)

      expect(html).toContain(String(status))
      expect(html).toContain(info.title)
      expect(html).toContain(ERROR_ILLUSTRATIONS[illustrationForStatus(status)])
    }
  })

  test('does not reach for the standalone files in public/svgs', () => {
    const html = renderProductionErrorPage(404)
    expect(html).not.toContain('/svgs/')
    expect(html).not.toContain('<img')
  })
})
