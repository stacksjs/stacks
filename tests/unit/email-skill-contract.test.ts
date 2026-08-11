import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const skill = readFileSync(resolve('storage/framework/defaults/ai/skills/stacks-email/SKILL.md'), 'utf8')
const command = readFileSync(resolve('storage/framework/core/buddy/src/commands/email.ts'), 'utf8')

describe('email skill contract', () => {
  it('documents inbound parsing and guarded attachment downloads', () => {
    expect(skill).toContain('## Inbound MIME and attachment storage')
    expect(skill).toContain('buddy email:reprocess')
    expect(skill).toContain('binary-safe S3 reads and opaque IDs')
    expect(skill).toContain("template: 'welcome'")
    expect(skill).not.toContain('templateName:')
  })

  it('keeps the reprocess command delegated and failure-aware', () => {
    expect(command).toContain("import { reprocessInboundEmails } from '../email-reprocess'")
    expect(command).toContain('storage: s3')
    expect(command).toContain('process.exit(ExitCode.Success)')
    expect(command).toContain('process.exit(ExitCode.FatalError)')
  })

  it('documents fail-fast delivery and model-backed safeguards', () => {
    expect(skill).toContain('`mail.send()` always returns an `EmailResult`')
    expect(skill).toContain('`mail.sendOrFail()`')
    expect(skill).toContain('`EmailDeliveryError`')
    expect(skill).toContain('## Delivery persistence models')
    expect(skill).toContain('`EmailSuppression`')
    expect(skill).toContain('`EmailIdempotency`')
    expect(skill).toContain('`EmailWebhookEvent`')
    expect(skill).toContain('authenticated `useApi`')
  })

  it('keeps generated guidance free of separator dash typography', () => {
    expect(skill).not.toMatch(/[\u2013\u2014]/)
  })
})
