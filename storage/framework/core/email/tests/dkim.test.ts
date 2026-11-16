import { describe, expect, test } from 'bun:test'
import { dkimRecord, dkimRecordKey, dkimRecordName, generateDkimKeyPair, signDkim, verifyDkim } from '../src/dkim'

const keys = generateDkimKeyPair()

const MESSAGE = [
  'From: Votescape <noreply@votescape.org>',
  'To: reader@example.com',
  'Subject: Your results are in',
  'Date: Sun, 15 Nov 2026 21:00:00 +0000',
  'Message-ID: <1@votescape.org>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Every county, as tall as its votes.',
  '',
].join('\r\n')

const OPTIONS = { domain: 'votescape.org', selector: 'commshq', privateKey: keys.privateKey }

describe('signing a message', () => {
  test('a signed message verifies against the published key, for the signing domain', () => {
    const signed = signDkim(MESSAGE, OPTIONS)
    expect(signed.startsWith('DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=votescape.org; s=commshq;')).toBe(true)
    expect(verifyDkim(signed, keys.publicKey)).toEqual({ ok: true, domain: 'votescape.org', selector: 'commshq' })
  })

  test('the message itself is carried unchanged after the signature', () => {
    const signed = signDkim(MESSAGE, OPTIONS)
    expect(signed.endsWith(MESSAGE)).toBe(true)
  })

  test('a changed body, subject or sender no longer verifies', () => {
    const signed = signDkim(MESSAGE, OPTIONS)
    expect(verifyDkim(signed.replace('as tall as its votes', 'as tall as its lies'), keys.publicKey)).toMatchObject({ ok: false, reason: 'the body was changed' })
    expect(verifyDkim(signed.replace('Your results are in', 'Send money'), keys.publicKey)).toMatchObject({ ok: false, reason: 'the signature does not match' })
    expect(verifyDkim(signed.replace('noreply@votescape.org', 'noreply@votescape.com'), keys.publicKey).ok).toBe(false)
  })

  test('another domain\'s key does not verify it', () => {
    expect(verifyDkim(signDkim(MESSAGE, OPTIONS), generateDkimKeyPair().publicKey).ok).toBe(false)
  })

  test('what a relay may change does not break it: line endings, header folding, trailing space and blank lines', () => {
    const signed = signDkim(MESSAGE.replace(/\r\n/g, '\n'), OPTIONS)
    expect(verifyDkim(signed, keys.publicKey).ok).toBe(true)

    const relayed = signed
      .replace('Subject: Your results are in', 'Subject:   Your results\r\n are in')
      .replace('Every county, as tall as its votes.', 'Every county, as tall as its votes.   ')
      .concat('\r\n\r\n')
    expect(verifyDkim(relayed, keys.publicKey).ok).toBe(true)
  })

  test('a header a server adds in front does not break it', () => {
    const signed = signDkim(MESSAGE, OPTIONS)
    expect(verifyDkim(`Received: from app by mail.example.com\r\n${signed}`, keys.publicKey).ok).toBe(true)
  })

  test('From is signed whatever the caller asks for, and a message without one is refused', () => {
    const signed = signDkim(MESSAGE, { ...OPTIONS, headers: ['subject'] })
    expect(signed).toContain('h=from:subject;')
    expect(() => signDkim('To: a@example.com\r\n\r\nhi', OPTIONS)).toThrow('no From field')
  })

  test('only fields that are present are named, so a later added one is not covered by accident', () => {
    expect(signDkim(MESSAGE, OPTIONS)).toContain('h=from:to:subject:date:message-id:mime-version:content-type;')
  })

  test('a domain or selector that is not a DNS name is refused', () => {
    expect(() => signDkim(MESSAGE, { ...OPTIONS, domain: 'votescape.org; b=x' })).toThrow('plain DNS names')
    expect(() => signDkim(MESSAGE, { ...OPTIONS, selector: 'a b' })).toThrow('plain DNS names')
  })
})

describe('publishing a key', () => {
  test('the record is the key in the form receivers read', () => {
    expect(keys.record).toMatch(/^v=DKIM1; k=rsa; p=[A-Za-z0-9+/]+=*$/)
    expect(dkimRecord(keys.publicKey)).toBe(keys.record)
    expect(dkimRecordName('Votescape.org.', 'CommsHQ')).toBe('commshq._domainkey.votescape.org')
  })

  test('a key is read back out of a TXT answer however DNS split it', () => {
    const key = dkimRecordKey(keys.record)
    const split = `"${keys.record.slice(0, 120)}" "${keys.record.slice(120)}"`
    expect(dkimRecordKey(split)).toBe(key)
    expect(dkimRecordKey('v=spf1 -all')).toBe('')
  })
})
