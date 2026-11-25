import { describe, expect, it } from 'bun:test'
import { renderAdmissionOptions } from '../src/production-server'

// `config/server.ts#render` reaches stx's admission as its own option names,
// and anything left unset stays unset so stx's defaults stand.

describe('renderAdmissionOptions', () => {
  it('is nothing at all when render is not configured', () => {
    expect(renderAdmissionOptions(undefined)).toEqual({})
    expect(renderAdmissionOptions({})).toEqual({})
  })

  it('names stx\'s options, and only the ones that are set', () => {
    expect(renderAdmissionOptions({ concurrency: 6, background: { match: () => false, retryAfterSeconds: 30 } })).toEqual({
      renderConcurrency: 6,
      renderBackgroundRetryAfterSeconds: 30,
      renderPriority: expect.any(Function),
    })
  })

  it('lowers what match names, and gives no answer for the rest', () => {
    const { renderPriority } = renderAdmissionOptions({ background: { match: request => request.url.includes('/tree/') } }) as { renderPriority: (request: Request) => string | undefined }

    expect(renderPriority(new Request('http://site.test/o/r/tree/main'))).toBe('background')
    // Not 'foreground': stx keeps a prefetch background unless told otherwise.
    expect(renderPriority(new Request('http://site.test/o/r/issues'))).toBeUndefined()
  })
})
