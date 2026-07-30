import { describe, expect, test } from 'bun:test'
import { getDashboardDnsSnapshot } from './dns-overview'

describe('dashboard DNS overview', () => {
  test('reports configured records without inventing provider state', () => {
    const snapshot = getDashboardDnsSnapshot({
      a: [{ name: '@', address: '192.0.2.10', ttl: 300 }],
      aaaa: [],
      cname: [{ name: 'www', target: '@' }],
      mx: [{ name: '@', server: 'mail.example.test', priority: 10, ttl: 3600 }],
      txt: [{ name: '@', value: 'v=spf1 -all' }],
      nameservers: ['ns1.example.test', 'ns2.example.test'],
    }, {
      infrastructure: {
        dns: {
          domain: 'example.test',
          hostedZoneId: 'zone-123',
        },
      },
    }, () => new Date('2026-07-30T12:00:00.000Z'))

    expect(snapshot.domains).toEqual([{
      domain: 'example.test',
      hostedZoneId: 'zone-123',
      status: 'configured',
    }])
    expect(snapshot.records).toHaveLength(4)
    expect(snapshot.records[1]).toMatchObject({
      type: 'CNAME',
      name: 'www',
      value: '@',
      ttl: null,
    })
    expect(snapshot.typeCounts).toEqual([
      { type: 'A', count: 1 },
      { type: 'AAAA', count: 0 },
      { type: 'CNAME', count: 1 },
      { type: 'MX', count: 1 },
      { type: 'TXT', count: 1 },
    ])
    expect(snapshot.generatedAt).toBe('2026-07-30T12:00:00.000Z')
  })

  test('keeps malformed or absent configuration empty', () => {
    const snapshot = getDashboardDnsSnapshot({
      a: 'not-an-array',
      nameservers: [null, '', 'ns.example.test'],
    }, null)

    expect(snapshot.domains).toEqual([])
    expect(snapshot.records).toEqual([])
    expect(snapshot.nameservers).toEqual(['ns.example.test'])
    expect(snapshot.typeCounts.every(item => item.count === 0)).toBe(true)
  })
})
