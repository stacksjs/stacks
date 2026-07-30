import { describe, expect, test } from 'bun:test'
import { getDashboardMailboxSnapshot } from './mailbox-overview'

describe('dashboard mailbox overview', () => {
  test('reports configured mail infrastructure without invented activity', () => {
    const snapshot = getDashboardMailboxSnapshot({
      domain: 'example.test',
      mailboxes: ['hello', 'support@example.test', { email: 'billing' }, {}],
      from: { name: 'Example', address: 'hello@example.test' },
      forwards: {
        'team@example.test': ['hello@example.test'],
      },
      server: {
        enabled: true,
        mode: 'server',
        scan: true,
        subdomain: 'mail',
        features: { imap: true, webmail: false, ignored: 'yes' },
        ports: { smtp: 25, imaps: 993, ignored: '443' },
        storage: { retentionDays: 90, archive: true, ignored: {} },
      },
    }, () => new Date('2026-07-30T12:00:00.000Z'))

    expect(snapshot.mailboxes.map(mailbox => mailbox.email)).toEqual([
      'hello@example.test',
      'support@example.test',
      'billing@example.test',
    ])
    expect(snapshot.domains[0]).toEqual({
      domain: 'example.test',
      subdomain: 'mail.example.test',
      status: 'configured',
    })
    expect(snapshot.server.features).toEqual([
      { name: 'imap', enabled: true },
      { name: 'webmail', enabled: false },
    ])
    expect(snapshot.server.ports).toEqual([
      { name: 'smtp', port: 25 },
      { name: 'imaps', port: 993 },
    ])
    expect(snapshot.server.storage).toEqual([
      { name: 'retentionDays', value: '90' },
      { name: 'archive', value: 'true' },
    ])
    expect(snapshot.generatedAt).toBe('2026-07-30T12:00:00.000Z')
  })

  test('keeps absent configuration empty', () => {
    const snapshot = getDashboardMailboxSnapshot(null)
    expect(snapshot.mailboxes).toEqual([])
    expect(snapshot.domains).toEqual([])
    expect(snapshot.forwards).toEqual([])
    expect(snapshot.server.enabled).toBe(false)
    expect(snapshot.server.mode).toBeNull()
  })
})
