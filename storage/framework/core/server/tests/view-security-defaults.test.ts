import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyViewSecurityHeaders, resolveViewSecurityRules } from '../src/security-headers'

// stacksjs/stacks#3358. Pages got three headers; HSTS reached API responses
// only, and nothing sent COOP or Permissions-Policy. Pages now get HSTS when
// the app is served over https on a real host, COOP that keeps OAuth and
// payment popups working, and a Permissions-Policy that turns off only
// features no stx composable uses.

const page = (): Response => new Response('<!doctype html><title>x</title>', { headers: { 'Content-Type': 'text/html' } })
const at = (path = '/login'): Request => new Request(`https://app.example.com${path}`)

describe('HSTS on pages', () => {
  test('is sent when APP_URL is https on a real host', () => {
    const res = page()
    applyViewSecurityHeaders(at(), res, resolveViewSecurityRules(undefined, 'https://app.example.com'))
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains')
  })

  test('is not sent over http, or for a local host served over https', () => {
    for (const url of ['http://app.example.com', 'https://stacks.localhost', 'https://localhost:3000', 'https://127.0.0.1', 'https://myapp.test', undefined]) {
      const res = page()
      applyViewSecurityHeaders(at(), res, resolveViewSecurityRules(undefined, url))
      expect(res.headers.get('Strict-Transport-Security')).toBeNull()
    }
  })

  test('hsts: false turns it off, and a string replaces the value', () => {
    let res = page()
    applyViewSecurityHeaders(at(), res, resolveViewSecurityRules({ hsts: false }, 'https://app.example.com'))
    expect(res.headers.get('Strict-Transport-Security')).toBeNull()
    res = page()
    applyViewSecurityHeaders(at(), res, resolveViewSecurityRules({ hsts: 'max-age=63072000; includeSubDomains; preload' }, 'https://app.example.com'))
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload')
  })
})

describe('COOP and Permissions-Policy on pages', () => {
  test('are on by default, and keep popups and composable-backed features working', () => {
    const res = page()
    applyViewSecurityHeaders(at(), res, resolveViewSecurityRules(undefined, 'http://localhost:3000'))
    expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups')
    const policy = res.headers.get('Permissions-Policy')!
    for (const off of ['browsing-topics=()', 'usb=()', 'serial=()', 'hid=()', 'bluetooth=()', 'midi=()'])
      expect(policy).toContain(off)
    // stx has composables for these, and Stripe needs payment.
    for (const kept of ['camera', 'microphone', 'geolocation', 'payment', 'fullscreen', 'clipboard'])
      expect(policy).not.toContain(kept)
  })

  test('an app can override a feature, add one, or turn either header off', () => {
    let res = page()
    applyViewSecurityHeaders(at(), res, resolveViewSecurityRules({ permissionsPolicy: { 'usb': 'self', 'camera': '()' }, crossOriginOpenerPolicy: 'same-origin' }, undefined))
    expect(res.headers.get('Permissions-Policy')).toContain('usb=self')
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()')
    expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin')
    res = page()
    applyViewSecurityHeaders(at(), res, resolveViewSecurityRules({ permissionsPolicy: false, crossOriginOpenerPolicy: false }, undefined))
    expect(res.headers.get('Permissions-Policy')).toBeNull()
    expect(res.headers.get('Cross-Origin-Opener-Policy')).toBeNull()
  })

  test('a header the response already carries wins', () => {
    const res = new Response('x', { headers: { 'Cross-Origin-Opener-Policy': 'unsafe-none' } })
    applyViewSecurityHeaders(at(), res, resolveViewSecurityRules(undefined, undefined))
    expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('unsafe-none')
  })
})

test('both views servers resolve the full rules from config, with APP_URL', () => {
  for (const file of ['../../actions/src/dev/views.ts', '../../buddy/src/production-server.ts']) {
    const source = readFileSync(join(import.meta.dir, file), 'utf8')
    expect(source).toContain('resolveViewSecurityRules(config.server?.security')
    expect(source).not.toContain('resolveEmbeddableRules(config.server?.security?.embeddable)')
  }
})
