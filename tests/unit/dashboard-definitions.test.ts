/**
 * The dashboard explains its acronyms and jargon where they appear, so it
 * makes sense to someone who has never run a mail server, edited DNS or
 * charged a sales tax. These pin the definitions so a later edit cannot drop
 * them quietly.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { taxTypeLabel } from '../../storage/framework/defaults/functions/commerce/tax-types'

const components = resolve('storage/framework/defaults/resources/components/Dashboard')
const source = (file: string) => readFileSync(resolve(components, file), 'utf8')

describe('dashboard definitions', () => {
  test('a known tax type reads with its meaning, and anything else as written', () => {
    expect(taxTypeLabel('GST')).toBe('GST (goods and services tax)')
    expect(taxTypeLabel('vat')).toBe('vat (value-added tax)')
    expect(taxTypeLabel('Customs Duty')).toBe('Customs Duty')
    expect(taxTypeLabel('')).toBe('')
  })

  test('a table column can explain its header', () => {
    const table = source('UI/Table.stx')
    expect(table).toContain('description?: string')
    expect(table.match(/<abbr :if="column\.description" :title="column\.description"/g)).toHaveLength(2)
  })

  test('the DNS page defines its record types and TTL', () => {
    const dns = source('Infrastructure/DnsDashboard.stx')
    expect(dns).toContain('Time to live: how long other servers may cache this record before asking again.')
    for (const option of ['A (IPv4 address)', 'AAAA (IPv6 address)', 'CNAME (alias)', 'MX (mail server)', 'TXT (text)'])
      expect(dns).toContain(option)
    expect(dns).toContain(':title="typeMeaning(item.type)"')
  })

  test('mail protocols use their real names and say what they do', () => {
    const mailboxes = source('Infrastructure/MailboxesDashboard.stx')
    for (const label of ['IMAP', 'POP3', 'CalDAV', 'CardDAV', 'ActiveSync', 'SMTPS', 'IMAPS', 'POP3S'])
      expect(mailboxes).toContain(`label: '${label}'`)
    expect(mailboxes).not.toContain('class="capitalize text-neutral-700 text-sm dark:text-neutral-300">{{ featureLabel')

    const mail = source('Settings/MailSettingsDashboard.stx')
    expect(mail).toContain('SMTP (Simple Mail Transfer Protocol)')
    expect(mail).toContain('Amazon SES (Simple Email Service)')
    expect(mail).toContain('STARTTLS (upgrade to encrypted, usually port 587)')
  })

  test('content pages say Content, not CMS', () => {
    for (const file of ['PagesDashboard.stx', 'PostsDashboard.stx', 'AuthorsDashboard.stx', 'CommentsDashboard.stx', 'ContentTaxonomyDashboard.stx'])
      expect(source(`Content/${file}`)).not.toContain('dark:text-blue-400">CMS</p>')
  })
})
