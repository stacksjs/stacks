import { describe, expect, test } from 'bun:test'
import { extractEmailPreview, normalizeEmailPreview } from '../src/mime-preview'

describe('email MIME previews', () => {
  test('prefers and decodes a multipart plain-text body', () => {
    const raw = [
      'From: sender@example.com',
      'Content-Type: multipart/alternative; boundary="part-1"',
      '',
      '--part-1',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'Great news=E2=80=94your account is ready.',
      '--part-1',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>HTML fallback</p>',
      '--part-1--',
    ].join('\r\n')

    expect(extractEmailPreview(raw)).toBe('Great news—your account is ready.')
  })

  test('removes legacy flattened MIME preambles', () => {
    expect(normalizeEmailPreview(
      '--001550 Content-Transfer-Encoding: quoted-printable Content-Type: text/plain; charset=utf-8 Mime-Version: 1.0 New sign-in detected for your account',
    )).toBe('New sign-in detected for your account')
  })

  test('strips markup and bounds the preview', () => {
    expect(extractEmailPreview('Content-Type: text/html\r\n\r\n<style>x{}</style><p>Hello &amp; welcome</p>', 12))
      .toBe('Hello & welc')
  })
})
