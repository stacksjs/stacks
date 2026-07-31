import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const components = resolve('storage/framework/defaults/resources/components/Dashboard/Auth')
const views = resolve('storage/framework/defaults/views/dashboard')

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('dashboard authentication legal navigation', () => {
  test('registration links resolve to componentized dashboard routes', () => {
    const register = read(resolve(components, 'Register.stx'))

    expect(register).toContain('href="/terms"')
    expect(register).toContain('href="/privacy"')
    expect(read(resolve(views, 'terms.stx'))).toContain('<TermsDashboard />')
    expect(read(resolve(views, 'privacy.stx'))).toContain('<PrivacyDashboard />')
  })

  test('legal pages share one reusable document shell and canonical actions', () => {
    const shell = read(resolve(components, 'LegalDocument.stx'))
    const terms = read(resolve(components, 'TermsDashboard.stx'))
    const privacy = read(resolve(components, 'PrivacyDashboard.stx'))

    expect(shell).toContain('<slot />')
    expect(shell).toContain('<Button tag="a" href="/register" variant="secondary">')
    expect(terms).toContain('<LegalDocument')
    expect(privacy).toContain('<LegalDocument')
    expect(terms).not.toContain('<button')
    expect(privacy).not.toContain('<button')
  })
})
