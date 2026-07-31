import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { readMailSettings, updateMailSettings } from './mail-settings'

async function fixture(content: string): Promise<{ envPath: string, backupPath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'stacks-dashboard-mail-'))
  const options = {
    envPath: join(root, '.env'),
    backupPath: join(root, 'runtime', 'environment.backup'),
  }
  await writeFile(options.envPath, content)
  return options
}

describe('dashboard mail settings', () => {
  test('reads real settings while returning only secret presence', async () => {
    const options = await fixture([
      'APP_NAME=Stacks',
      'MAIL_MAILER=smtp',
      'MAIL_FROM_ADDRESS=hello@example.com',
      'MAIL_HOST=mailpit',
      'MAIL_PORT=1025',
      'MAIL_USERNAME=null',
      'MAIL_PASSWORD=super-secret',
      'MAIL_ENCRYPTION=null',
      '',
    ].join('\n'))

    const settings = await readMailSettings(options)
    expect(settings).toMatchObject({
      driver: 'smtp',
      fromName: 'Stacks',
      fromAddress: 'hello@example.com',
      smtp: {
        host: 'mailpit',
        port: 1025,
        username: '',
        encryption: '',
        passwordConfigured: true,
      },
    })
    expect(JSON.stringify(settings)).not.toContain('super-secret')
  })

  test('updates selected SMTP keys atomically and preserves a blank password', async () => {
    const options = await fixture([
      'MAIL_MAILER=log',
      'MAIL_FROM_NAME=Stacks',
      'MAIL_FROM_ADDRESS=hello@example.com',
      'MAIL_PASSWORD=keep-this',
      'APP_KEY=untouched',
      '',
    ].join('\n'))
    const current = await readMailSettings(options)

    const result = await updateMailSettings({
      revision: current.revision,
      driver: 'smtp',
      fromName: 'Mail Team',
      fromAddress: 'mailer@example.com',
      smtp: {
        host: 'smtp.example.com',
        port: '587',
        username: 'mailer',
        encryption: 'tls',
        password: '',
        clearPassword: false,
      },
    }, options)

    expect('state' in result).toBe(true)
    const content = await readFile(options.envPath, 'utf8')
    expect(content).toContain('MAIL_MAILER=smtp')
    expect(content).toContain('MAIL_FROM_NAME="Mail Team"')
    expect(content).toContain('MAIL_PASSWORD=keep-this')
    expect(content).toContain('APP_KEY=untouched')
    expect(content).toContain('MAIL_HOST=smtp.example.com')
    expect(await readFile(options.backupPath, 'utf8')).toContain('MAIL_MAILER=log')
  })

  test('requires provider credentials without returning stored secrets', async () => {
    const options = await fixture([
      'MAIL_MAILER=log',
      'MAIL_FROM_ADDRESS=hello@example.com',
      '',
    ].join('\n'))
    const current = await readMailSettings(options)

    const invalid = await updateMailSettings({
      revision: current.revision,
      driver: 'sendgrid',
      fromName: 'Stacks',
      fromAddress: 'hello@example.com',
      sendgrid: { apiKey: '', clearApiKey: false },
    }, options)

    expect(invalid).toEqual({
      validation: {
        fields: { 'sendgrid.apiKey': 'Enter a SendGrid API key.' },
      },
    })

    const saved = await updateMailSettings({
      revision: current.revision,
      driver: 'sendgrid',
      fromName: 'Stacks',
      fromAddress: 'hello@example.com',
      sendgrid: { apiKey: 'SG.private', clearApiKey: false },
    }, options)
    expect('state' in saved && saved.state.sendgrid.apiKeyConfigured).toBe(true)
    expect(JSON.stringify(saved)).not.toContain('SG.private')
    expect(await readFile(options.envPath, 'utf8')).toContain('SENDGRID_API_KEY=SG.private')
  })

  test('rejects stale revisions and unsupported drivers', async () => {
    const options = await fixture('MAIL_MAILER=log\nMAIL_FROM_ADDRESS=hello@example.com\n')

    const stale = await updateMailSettings({
      revision: '0'.repeat(64),
      driver: 'log',
      fromName: 'Stacks',
      fromAddress: 'hello@example.com',
    }, options)
    expect(stale).toEqual({ conflict: true })

    const current = await readMailSettings(options)
    const invalid = await updateMailSettings({
      revision: current.revision,
      driver: 'sendmail',
      fromName: 'Stacks',
      fromAddress: 'hello@example.com',
    }, options)
    expect(invalid).toEqual({
      validation: {
        fields: { driver: 'Choose a supported mail driver.' },
      },
    })
  })

  test('reports malformed persisted mail settings instead of replacing them with defaults', async () => {
    const invalidDriver = await fixture('MAIL_MAILER=sendmail\n')
    await expect(readMailSettings(invalidDriver)).rejects.toThrow('MAIL_MAILER must be one of')

    const invalidPort = await fixture('MAIL_MAILER=smtp\nMAIL_PORT=not-a-port\n')
    await expect(readMailSettings(invalidPort)).rejects.toThrow('MAIL_PORT must be an integer')

    const invalidEncryption = await fixture('MAIL_MAILER=smtp\nMAIL_ENCRYPTION=starttls\n')
    await expect(readMailSettings(invalidEncryption)).rejects.toThrow('MAIL_ENCRYPTION must be empty, tls, or ssl')

    const malformedEnvironment = await fixture('MAIL_MAILER=log\nMAIL_MAILER=smtp\n')
    await expect(readMailSettings(malformedEnvironment)).rejects.toThrow('environment file is invalid on line 2')
  })
})
