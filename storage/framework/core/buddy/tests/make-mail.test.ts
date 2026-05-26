import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMail } from '@stacksjs/actions'
import { path as p } from '@stacksjs/path'

// stacksjs/stacks#1899 (A2) — buddy make:mail scaffolding.

// The createMail action writes to projectPath()-relative paths via the
// path singleton. We can't easily intercept that without a heavier
// fixture, so these tests check the path-derivation + idempotency logic
// against the real project tree, cleaning up after each case.

const generated: string[] = []

afterEach(() => {
  for (const path of generated.splice(0)) {
    try { rmSync(path) } catch { /* already gone */ }
  }
})

describe('createMail', () => {
  test('PascalCases a kebab name for the class file', async () => {
    const ok = await createMail({ name: 'order-shipped' } as any)
    expect(ok).toBe(true)
    const mailPath = p.userMailPath('OrderShipped.ts')
    const templatePath = p.userEmailsPath('order-shipped.stx')
    generated.push(mailPath, templatePath)
    expect(existsSync(mailPath)).toBe(true)
    expect(existsSync(templatePath)).toBe(true)
  })

  test('kebab-cases a PascalName for the template file', async () => {
    const ok = await createMail({ name: 'WelcomeBack' } as any)
    expect(ok).toBe(true)
    const mailPath = p.userMailPath('WelcomeBack.ts')
    const templatePath = p.userEmailsPath('welcome-back.stx')
    generated.push(mailPath, templatePath)
    expect(existsSync(mailPath)).toBe(true)
    expect(existsSync(templatePath)).toBe(true)
  })

  test('emitted Mailable references the kebab template name', async () => {
    const ok = await createMail({ name: 'PaymentReceived' } as any)
    expect(ok).toBe(true)
    const mailPath = p.userMailPath('PaymentReceived.ts')
    const templatePath = p.userEmailsPath('payment-received.stx')
    generated.push(mailPath, templatePath)
    const content = readFileSync(mailPath, 'utf-8')
    // The build() method should reference the kebab template name
    expect(content).toContain(`.template('payment-received'`)
    // Plus the canonical Mailable scaffold pieces
    expect(content).toContain('export class PaymentReceived extends Mailable')
    expect(content).toContain('export interface PaymentReceivedProps')
  })

  test('refuses to overwrite when files already exist', async () => {
    const first = await createMail({ name: 'AlreadyHere' } as any)
    expect(first).toBe(true)
    const mailPath = p.userMailPath('AlreadyHere.ts')
    const templatePath = p.userEmailsPath('already-here.stx')
    generated.push(mailPath, templatePath)

    const second = await createMail({ name: 'AlreadyHere' } as any)
    expect(second).toBe(false)
  })

  test('--force overwrites existing files', async () => {
    const first = await createMail({ name: 'OverwriteMe' } as any)
    expect(first).toBe(true)
    const mailPath = p.userMailPath('OverwriteMe.ts')
    const templatePath = p.userEmailsPath('overwrite-me.stx')
    generated.push(mailPath, templatePath)

    const forced = await createMail({ name: 'OverwriteMe', force: true } as any)
    expect(forced).toBe(true)
  })

  test('returns false on an empty name', async () => {
    expect(await createMail({ name: '' } as any)).toBe(false)
    expect(await createMail({ name: '   ' } as any)).toBe(false)
  })

  test('emitted stx template references appName via {{ appName }}', async () => {
    const ok = await createMail({ name: 'ReceiptEmail' } as any)
    expect(ok).toBe(true)
    const templatePath = p.userEmailsPath('receipt-email.stx')
    generated.push(p.userMailPath('ReceiptEmail.ts'), templatePath)
    const content = readFileSync(templatePath, 'utf-8')
    expect(content).toContain('<script server>')
    expect(content).toContain('{{ appName }}')
    expect(content).toContain('<!DOCTYPE html>')
  })
})
