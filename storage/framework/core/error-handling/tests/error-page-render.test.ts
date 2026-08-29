import { describe, expect, it } from 'bun:test'
import { ErrorPageHandler } from '../src/error-page'

/**
 * The dev error page renders from its templates, not from the fallback.
 *
 * `ErrorPageHandler.render` wraps the whole stx render in a try/catch and
 * returns `renderFallback` on any failure. That is the right behaviour - an
 * error page that throws while reporting an error is useless - but it means a
 * broken template degrades silently: you still get an error page, just a much
 * worse one, and nothing says why.
 *
 * These templates were also outside every typecheck glob, so the names they
 * read from `ErrorPageViewModel` were unverified in both directions at once.
 * They now declare that contract (see the `<script server>` block at the top
 * of each), and this pins the result: the real templates render, the
 * declarations erase, and the fallback is not what you are looking at.
 */

async function render(error: Error, status = 500): Promise<string> {
  return new ErrorPageHandler().render(error, status)
}

describe('the dev error page', () => {
  it('renders the real templates rather than the fallback', async () => {
    const html = await render(new Error('a thrown message'))

    // The fallback is a small hand-built string with none of this in it.
    expect(html).toContain('data-trace-frame')
    expect(html).toContain('stacksCopy')
    expect(html.length).toBeGreaterThan(10_000)
  })

  it('renders the error message and a title', async () => {
    const html = await render(new Error('a thrown message'))

    expect(html).toContain('a thrown message')
    expect(html).toMatch(/<title>[^<]*\S[^<]*<\/title>/)
  })

  it('passes the separator its class through the renamed prop', async () => {
    // `class` is a reserved word, so the prop is `extraClass`; if the rename
    // missed a call site the separator renders with no class at all.
    const html = await render(new Error('a thrown message'))

    expect(html).toContain('-mt-5')
  })

  it('emits none of the type-only declarations the templates carry', async () => {
    const html = await render(new Error('a thrown message'))

    expect(html).not.toContain('declare const')
    expect(html).not.toContain('error-page-view-model')
  })

  it('renders a 404 as well as a 500', async () => {
    const html = await render(new Error('missing'), 404)

    expect(html).toMatch(/<title>[^<]*\S[^<]*<\/title>/)
    expect(html.length).toBeGreaterThan(10_000)
  })
})
