// Azure request signing (stacksjs/stacks#1896).
//
// Signing is the part of a storage driver that cannot be debugged from a failed
// request: Azure answers a mis-signed one with `AuthenticationFailed` and the
// string IT computed, which only helps if you can put yours next to it. So the
// string-to-sign is asserted directly, field by field, rather than inferred
// from whether a call succeeded.
//
// The account key below is a fixed test vector, not a credential - it is the
// base64 of a short ASCII string, so a signature computed from it is
// reproducible by hand.

import { Buffer } from 'node:buffer'
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'bun:test'
import {
  canonicalizedHeaders,
  canonicalizedResource,
  orderSasPermissions,
  SAS_VERSION,
  sasTimestamp,
  serviceSasQuery,
  sharedKeyAuthorization,
  sharedKeyStringToSign,
} from '../src/azure-signing'

const ACCOUNT = 'testaccount'
const ACCOUNT_KEY = Buffer.from('a-test-key-not-a-credential').toString('base64')

/** The independent implementation the assertions below compare against. */
function expectedSignature(stringToSign: string): string {
  return createHmac('sha256', Buffer.from(ACCOUNT_KEY, 'base64')).update(stringToSign, 'utf8').digest('base64')
}

describe('canonicalizedHeaders', () => {
  it('keeps only x-ms-* headers, lowercased and sorted', () => {
    const result = canonicalizedHeaders({
      'x-ms-version': '2021-08-06',
      'Content-Type': 'text/plain',
      'X-MS-Date': 'Mon, 01 Jan 2024 00:00:00 GMT',
      'x-ms-blob-type': 'BlockBlob',
    })

    expect(result).toBe(
      'x-ms-blob-type:BlockBlob\n'
      + 'x-ms-date:Mon, 01 Jan 2024 00:00:00 GMT\n'
      + 'x-ms-version:2021-08-06\n',
    )
  })

  it('sorts by ordinal, not by locale', () => {
    // `localeCompare` orders these differently under some locales, which is a
    // signature that works on one machine and fails on another.
    const result = canonicalizedHeaders({ 'x-ms-z': '1', 'x-ms-A': '2', 'x-ms-_': '3' })
    const names = result.trim().split('\n').map(line => line.split(':')[0])

    expect(names).toEqual([...names].sort())
  })

  it('collapses whitespace inside values and drops empty ones', () => {
    expect(canonicalizedHeaders({ 'x-ms-meta-note': '  two   words  ' })).toBe('x-ms-meta-note:two words\n')
    expect(canonicalizedHeaders({ 'x-ms-meta-note': '', 'x-ms-meta-other': undefined })).toBe('')
  })
})

describe('canonicalizedResource', () => {
  it('is the account-scoped path when there is no query', () => {
    expect(canonicalizedResource(ACCOUNT, `https://${ACCOUNT}.blob.core.windows.net/uploads/a.txt`))
      .toBe(`/${ACCOUNT}/uploads/a.txt`)
  })

  it('adds one lowercased, sorted line per query parameter', () => {
    const result = canonicalizedResource(ACCOUNT, `https://${ACCOUNT}.blob.core.windows.net/uploads?restype=container&COMP=list`)

    expect(result).toBe(`/${ACCOUNT}/uploads\ncomp:list\nrestype:container`)
  })

  it('joins a repeated parameter with commas, in sorted order', () => {
    // So `?include=snapshots&include=metadata` signs the same however the
    // caller happened to build it.
    const a = canonicalizedResource(ACCOUNT, `https://${ACCOUNT}.blob.core.windows.net/c?include=snapshots&include=metadata`)
    const b = canonicalizedResource(ACCOUNT, `https://${ACCOUNT}.blob.core.windows.net/c?include=metadata&include=snapshots`)

    expect(a).toBe(`/${ACCOUNT}/c\ninclude:metadata,snapshots`)
    expect(a).toBe(b)
  })
})

describe('sharedKeyStringToSign', () => {
  const url = `https://${ACCOUNT}.blob.core.windows.net/uploads/a.txt`

  it('lays the fields out positionally, blank lines included', () => {
    const stringToSign = sharedKeyStringToSign(ACCOUNT, {
      method: 'PUT',
      url,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': '11',
        'x-ms-blob-type': 'BlockBlob',
        'x-ms-date': 'Mon, 01 Jan 2024 00:00:00 GMT',
        'x-ms-version': '2021-08-06',
      },
    })

    expect(stringToSign).toBe([
      'PUT',
      '', // Content-Encoding
      '', // Content-Language
      '11',
      '', // Content-MD5
      'text/plain',
      '', // Date - superseded by x-ms-date
      '', // If-Modified-Since
      '', // If-Match
      '', // If-None-Match
      '', // If-Unmodified-Since
      '', // Range
      'x-ms-blob-type:BlockBlob',
      'x-ms-date:Mon, 01 Jan 2024 00:00:00 GMT',
      'x-ms-version:2021-08-06',
      `/${ACCOUNT}/uploads/a.txt`,
    ].join('\n'))
  })

  it('sends an empty Content-Length for a zero-length body', () => {
    // Versions before 2015-02-21 signed a literal `0`; Azure has read it as
    // empty ever since, so a DELETE or a HEAD signs the blank.
    const zero = sharedKeyStringToSign(ACCOUNT, { method: 'DELETE', url, headers: { 'Content-Length': '0' } })
    const absent = sharedKeyStringToSign(ACCOUNT, { method: 'DELETE', url, headers: {} })

    expect(zero).toBe(absent)
  })

  it('has one line per positional field even when every header is absent', () => {
    const stringToSign = sharedKeyStringToSign(ACCOUNT, { method: 'GET', url, headers: {} })

    // 12 positional fields, then the canonicalized resource. A dropped blank
    // line here shifts every field after it, which is the failure mode this
    // guards.
    expect(stringToSign.split('\n')).toHaveLength(13)
    expect(stringToSign.split('\n').at(-1)).toBe(`/${ACCOUNT}/uploads/a.txt`)
  })

  it('reads headers case-insensitively', () => {
    const lower = sharedKeyStringToSign(ACCOUNT, { method: 'GET', url, headers: { 'content-type': 'text/plain' } })
    const upper = sharedKeyStringToSign(ACCOUNT, { method: 'GET', url, headers: { 'Content-Type': 'text/plain' } })

    expect(lower).toBe(upper)
  })
})

describe('sharedKeyAuthorization', () => {
  it('is SharedKey, the account, and the HMAC of the string-to-sign', () => {
    const request = {
      method: 'GET',
      url: `https://${ACCOUNT}.blob.core.windows.net/uploads/a.txt`,
      headers: { 'x-ms-date': 'Mon, 01 Jan 2024 00:00:00 GMT', 'x-ms-version': '2021-08-06' },
    }

    const header = sharedKeyAuthorization({ account: ACCOUNT, accountKey: ACCOUNT_KEY }, request)

    expect(header).toBe(`SharedKey ${ACCOUNT}:${expectedSignature(sharedKeyStringToSign(ACCOUNT, request))}`)
  })

  it('changes when any signed part of the request changes', () => {
    const base = {
      method: 'GET',
      url: `https://${ACCOUNT}.blob.core.windows.net/uploads/a.txt`,
      headers: { 'x-ms-date': 'Mon, 01 Jan 2024 00:00:00 GMT' },
    }
    const credential = { account: ACCOUNT, accountKey: ACCOUNT_KEY }
    const signed = sharedKeyAuthorization(credential, base)

    expect(sharedKeyAuthorization(credential, { ...base, method: 'DELETE' })).not.toBe(signed)
    expect(sharedKeyAuthorization(credential, { ...base, url: `${base.url}?comp=metadata` })).not.toBe(signed)
    expect(sharedKeyAuthorization(credential, {
      ...base,
      headers: { ...base.headers, 'x-ms-blob-type': 'BlockBlob' },
    })).not.toBe(signed)
  })
})

describe('orderSasPermissions', () => {
  it('puts letters into Azure\'s required order', () => {
    // The service compares against a fixed order rather than as a set, so `wr`
    // is not `rw` - it answers AuthorizationPermissionMismatch, which reads
    // like the SAS lacks a permission it plainly names.
    expect(orderSasPermissions('wr')).toBe('rw')
    expect(orderSasPermissions('dcw')).toBe('cwd')
  })

  it('drops duplicates and anything unrecognised', () => {
    expect(orderSasPermissions('rrr')).toBe('r')
    expect(orderSasPermissions('rZ!')).toBe('r')
    expect(orderSasPermissions('')).toBe('')
  })

  it('is case-insensitive', () => {
    expect(orderSasPermissions('RW')).toBe('rw')
  })
})

describe('sasTimestamp', () => {
  it('is UTC with second precision and no milliseconds', () => {
    // Azure rejects a fractional-second `se`, and the value is signed, so a
    // stray `.000` is an AuthenticationFailed rather than a validation error.
    expect(sasTimestamp(new Date('2024-01-02T03:04:05.678Z'))).toBe('2024-01-02T03:04:05Z')
  })
})

describe('serviceSasQuery', () => {
  const credential = { account: ACCOUNT, accountKey: ACCOUNT_KEY }
  const expiresAt = new Date('2024-01-02T03:04:05Z')

  it('signs the documented field list, in order', () => {
    const query = new URLSearchParams(serviceSasQuery(credential, {
      container: 'uploads',
      blob: 'reports/q1.pdf',
      permissions: 'r',
      expiresAt,
    }))

    const stringToSign = [
      'r',
      '', // signedStart
      '2024-01-02T03:04:05Z',
      `/blob/${ACCOUNT}/uploads/reports/q1.pdf`,
      '', // signedIdentifier
      '', // signedIP
      'https',
      SAS_VERSION,
      'b',
      '', // signedSnapshotTime
      '', // signedEncryptionScope
      '', // rscc
      '', // rscd
      '', // rsce
      '', // rscl
      '', // rsct
    ].join('\n')

    expect(query.get('sig')).toBe(expectedSignature(stringToSign))
  })

  it('carries the version, resource, permissions and expiry it signed', () => {
    const query = new URLSearchParams(serviceSasQuery(credential, {
      container: 'uploads',
      blob: 'a.txt',
      permissions: 'r',
      expiresAt,
    }))

    expect(query.get('sv')).toBe(SAS_VERSION)
    expect(query.get('sr')).toBe('b')
    expect(query.get('sp')).toBe('r')
    expect(query.get('se')).toBe('2024-01-02T03:04:05Z')
    expect(query.get('spr')).toBe('https')
    // Omitted rather than sent empty: an empty `st` is not the same request.
    expect(query.has('st')).toBeFalse()
  })

  it('signs the container itself when no blob is named', () => {
    // Which is what a listing URL needs; `sr` says so.
    const query = new URLSearchParams(serviceSasQuery(credential, {
      container: 'uploads',
      permissions: 'l',
      expiresAt,
    }))

    expect(query.get('sr')).toBe('c')
    expect(query.get('sp')).toBe('l')
  })

  it('reorders the permissions before signing them', () => {
    const reordered = serviceSasQuery(credential, { container: 'c', blob: 'a', permissions: 'wr', expiresAt })
    const canonical = serviceSasQuery(credential, { container: 'c', blob: 'a', permissions: 'rw', expiresAt })

    expect(reordered).toBe(canonical)
    expect(new URLSearchParams(reordered).get('sp')).toBe('rw')
  })

  it('includes the response-header overrides in both the signature and the query', () => {
    // rscd/rsct are signed fields, so sending one that was not signed is
    // rejected - they have to travel together.
    const query = new URLSearchParams(serviceSasQuery(credential, {
      container: 'uploads',
      blob: 'a.pdf',
      permissions: 'r',
      expiresAt,
      contentDisposition: 'attachment; filename="q1.pdf"',
      contentType: 'application/pdf',
    }))

    expect(query.get('rscd')).toBe('attachment; filename="q1.pdf"')
    expect(query.get('rsct')).toBe('application/pdf')

    const without = new URLSearchParams(serviceSasQuery(credential, {
      container: 'uploads',
      blob: 'a.pdf',
      permissions: 'r',
      expiresAt,
    }))
    expect(query.get('sig')).not.toBe(without.get('sig'))
  })

  it('signs the start time and the IP restriction when given', () => {
    const query = new URLSearchParams(serviceSasQuery(credential, {
      container: 'uploads',
      blob: 'a.txt',
      permissions: 'r',
      startsAt: new Date('2024-01-01T00:00:00Z'),
      expiresAt,
      ip: '203.0.113.1-203.0.113.9',
      protocol: 'https,http',
    }))

    expect(query.get('st')).toBe('2024-01-01T00:00:00Z')
    expect(query.get('sip')).toBe('203.0.113.1-203.0.113.9')
    expect(query.get('spr')).toBe('https,http')
  })
})
