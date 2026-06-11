import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import { join } from 'node:path'
import { defaultsResourcesPath } from '@stacksjs/path'
import { template, templateExists } from '../src/template'

// stacksjs/stacks#1944 — template() resolution order.
//
// template() must resolve userland `resources/emails/` first and fall
// back to the framework-shipped defaults in
// `storage/framework/defaults/resources/emails/` (dir-major: ANY
// userland file, either extension, beats the defaults copy). Before
// the fix, every probe was userland-only, so on a default install the
// prebaked auth mailers (password-reset, password-changed,
// email-verification) could never reach the shipped templates and
// degraded to plain-text fallback.
//
// Test strategy: the path helpers are cwd-derived (projectPath walks
// up from process.cwd() until 'storage' leaves the path), so we build
// a pristine fake project root in a temp dir (os.tmpdir() contains no
// 'storage' segment on macOS or Linux), copy the real shipped
// defaults into it, leave userland resources/emails empty, and chdir
// into it. NOTE: bun test runs a directory's files in one shared
// process — same caveat prebaked-mailers.test.ts documents for
// mock.module — so restoring the original cwd in afterAll is
// mandatory or the temp cwd would leak into later test files.

// Capture the real repo defaults BEFORE any chdir.
const repoDefaultsEmails = defaultsResourcesPath('emails')
const repoDefaultsComponents = defaultsResourcesPath('components/Email')

let tempRoot: string
let originalCwd: string

beforeAll(() => {
  originalCwd = process.cwd()
  tempRoot = fs.mkdtempSync(join(os.tmpdir(), 'stacks-email-'))

  // Ship the framework vendor layer into the fake project root.
  fs.cpSync(repoDefaultsEmails, join(tempRoot, 'storage/framework/defaults/resources/emails'), { recursive: true })
  fs.cpSync(repoDefaultsComponents, join(tempRoot, 'storage/framework/defaults/resources/components/Email'), { recursive: true })

  // Userland exists but ships no email templates (pristine install).
  fs.mkdirSync(join(tempRoot, 'resources/emails'), { recursive: true })

  process.chdir(tempRoot)
})

afterAll(() => {
  process.chdir(originalCwd)
  fs.rmSync(tempRoot, { recursive: true, force: true })
})

describe('email template resolution (#1944)', () => {
  test('falls back to framework defaults when userland has no template', async () => {
    const resetUrl = 'https://acme.test/reset/tok123'
    const { html, text } = await template('password-reset', {
      variables: { resetUrl, expireMinutes: 30 },
    })

    // The real shipped template, rendered through the full template()
    // path (including the defaults componentsDir for <EmailButton> & co).
    expect(html.length).toBeGreaterThan(1000)
    expect(html).toContain(resetUrl)
    expect(text).toContain(resetUrl)
    expect(html).toContain('Reset Password')
  })

  test('userland template wins over the defaults copy', async () => {
    const overridePath = join(tempRoot, 'resources/emails/password-reset.stx')
    fs.writeFileSync(overridePath, '<p>USERLAND-OVERRIDE</p>\n')

    try {
      const { html } = await template('password-reset', {
        variables: { resetUrl: 'https://acme.test/reset/tok123' },
      })

      expect(html).toContain('USERLAND-OVERRIDE')
      // Defaults button copy must NOT leak through.
      expect(html).not.toContain('Reset Password')
    }
    finally {
      fs.rmSync(overridePath, { force: true })
    }
  })

  test('dir-major ordering: userland .html beats defaults .stx', async () => {
    fs.writeFileSync(
      join(tempRoot, 'storage/framework/defaults/resources/emails/ordering-probe-1944.stx'),
      '<p>DEFAULTS-STX-SENTINEL</p>\n',
    )
    fs.writeFileSync(
      join(tempRoot, 'resources/emails/ordering-probe-1944.html'),
      '<p>USERLAND-HTML-SENTINEL</p>\n',
    )

    const { html } = await template('ordering-probe-1944', { layout: false })

    expect(html).toContain('USERLAND-HTML-SENTINEL')
    expect(html).not.toContain('DEFAULTS-STX-SENTINEL')
  })

  test('returns the empty-result contract when no template exists anywhere', async () => {
    const result = await template('no-such-template-xyz-1944')
    expect(result).toEqual({ html: '', text: '' })
  })

  test('templateExists() resolves defaults too', () => {
    // Only present in defaults (userland override was cleaned up above).
    expect(templateExists('password-reset')).toBe(true)
    expect(templateExists('no-such-template-xyz-1944')).toBe(false)
  })

  test('userland .html template wraps in the defaults base layout', async () => {
    fs.writeFileSync(
      join(tempRoot, 'resources/emails/layout-probe-1944.html'),
      '<p>LAYOUT-PROBE-BODY</p>\n',
    )

    const { html } = await template('layout-probe-1944', {
      layout: 'base',
      subject: 'Layout probe',
    })

    expect(html).toContain('LAYOUT-PROBE-BODY')
    // Stable markers from defaults/resources/emails/layouts/base.html —
    // before the fix this warned 'Layout not found' and rendered the
    // bare fragment instead.
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('o:OfficeDocumentSettings')
  })
})
