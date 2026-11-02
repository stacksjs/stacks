import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { acceptedPublications, publicationMatchesOriginal, verifyAcceptedPublications } from '../../../../../.github/scripts/npm-publication'
import { priorPublicationReceipts } from '../../../../../.github/scripts/resume-npm-publication'

const archive = new TextEncoder().encode('original packed release bytes')
const receipt = {
  name: '@stacksjs/enums',
  version: '0.75.260',
  integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}`,
  shasum: createHash('sha1').update(archive).digest('hex'),
}
const messages = [
  'Upload accepted; publication is pending public metadata and verified tarball availability. Do not upload this version again.',
  'Upload outcome is pending public verification. Do not send another upload while this version may be staged.',
]

function log(message: string, integrity = receipt.integrity) {
  return `Publishing ${receipt.name}@${receipt.version}...
Shasum: ${receipt.shasum}
Integrity: ${integrity}
  Error: ${message}`
}

test.each(messages)('keeps the original archive identity for %s', (message) => {
  expect(acceptedPublications(log(message))).toEqual([receipt])
  expect(() => acceptedPublications(log(message, 'missing'))).toThrow('no complete original archive receipt')
})

test('an ambiguous upload cannot replace a previous original receipt', () => {
  const different = `sha512-${createHash('sha512').update('different bytes').digest('base64')}`
  expect(() => acceptedPublications(`${log(messages[0])}\n${log(messages[1], different)}`)).toThrow('Conflicting original archive receipts')
  expect(acceptedPublications('Error: OIDC authentication failed')).toEqual([])
})

function provenanceUpload(integrity = receipt.integrity, acknowledgedName = receipt.name) {
  return [
    `Publishing ${receipt.name}@${receipt.version}...`,
    `Shasum: ${receipt.shasum}`,
    `Integrity: ${integrity}`,
    '  accepted by npm; read back once a package needs it or the batch is uploaded',
    '✓ Sigstore provenance attached',
    `✓ Uploaded ${acknowledgedName}@${receipt.version} with provenance`,
  ].join('\n')
}

test('retains a provenance upload before a later package fails', () => {
  expect(acceptedPublications(`${provenanceUpload()}\nPublishing @stacksjs/next@${receipt.version}...\nError: registry unavailable`)).toEqual([receipt])
  expect(acceptedPublications(provenanceUpload().split('\n').slice(0, -1).join('\n'))).toEqual([])
})

test('provenance acknowledgements require complete matching original archive identity', () => {
  expect(() => acceptedPublications(provenanceUpload('missing'))).toThrow('no complete original archive receipt')
  expect(() => acceptedPublications(provenanceUpload(receipt.integrity, '@stacksjs/other'))).toThrow('does not match')
  const different = `sha512-${createHash('sha512').update('different bytes').digest('base64')}`
  expect(() => acceptedPublications(`${log(messages[0])}\n${provenanceUpload(different)}`)).toThrow('Conflicting original archive receipts')
})

test('a verified provenance publication retains its original receipt if a later hook or package fails', () => {
  const published = provenanceUpload().replace('✓ Uploaded ', '✓ Published ')
  expect(acceptedPublications(`${published}\nError: postpublish failed`)).toEqual([receipt])
  expect(() => acceptedPublications(published.replace(receipt.integrity, 'missing'))).toThrow('no complete original archive receipt')
  expect(() => acceptedPublications(published.replace(`✓ Published ${receipt.name}@`, '✓ Published @stacksjs/other@'))).toThrow('does not match')
  expect(acceptedPublications(published.split('\n').slice(0, -1).join('\n'))).toEqual([])
})

test('an ambiguous outcome still needs matching metadata and complete original bytes', async () => {
  const original = acceptedPublications(log(messages[1]))[0]
  expect(original).toEqual(receipt)
  const tarball = 'https://registry.npmjs.org/@stacksjs/enums/-/enums-0.75.260.tgz'
  const metadata = { ...receipt, dist: { ...receipt, tarball } }
  const read = async (url: string) => url === tarball ? new Response(archive) : Response.json(metadata)
  expect(await publicationMatchesOriginal(original, read)).toBe(true)
  expect(await publicationMatchesOriginal(original, async () => new Response(null, { status: 404 }))).toBe(false)
  expect(await publicationMatchesOriginal(original, async url => url === tarball
    ? new Response('truncated or replaced') : Response.json(metadata))).toBe(false)
  expect(await publicationMatchesOriginal(original, async () => Response.json({
    ...metadata, dist: { ...metadata.dist, integrity: 'sha512-different' },
  }))).toBe(false)
})


test('a restarted publisher reads timestamped original receipts and waits for their actual archives', async () => {
  const original = provenanceUpload().split('\n').map(line => `2026-11-02T06:12:11.704Z ${line}`).join('\n')
  expect(acceptedPublications(original)).toEqual([receipt])
  let reads = 0
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    expect(request.method).toBe('GET')
    expect(request.headers.has('authorization')).toBe(false)
    if (new URL(request.url).pathname.endsWith('.tgz')) return new Response(archive)
    if (++reads === 1) return new Response(null, { status: 404 })
    return Response.json({ name: receipt.name, version: receipt.version,
      dist: { integrity: receipt.integrity, shasum: receipt.shasum,
        tarball: 'https://registry.npmjs.org/@stacksjs/enums/-/enums-0.75.260.tgz' } })
  } })
  try {
    await verifyAcceptedPublications(acceptedPublications(original), {
      budgetMs: 1000, pollMs: 5,
      read: (url, init) => fetch(new URL(new URL(url).pathname, server.url), init),
    })
    expect(reads).toBe(2)
  }
  finally { await server.stop(true) }
})


test('recovery refuses another cohort and conflicting original archives across attempts', () => {
  const names = new Set([receipt.name])
  const original = provenanceUpload()
  expect(priorPublicationReceipts([original, 'Error: network unavailable'], receipt.version, names)).toEqual([receipt])
  expect(() => priorPublicationReceipts([original], '0.75.261', names)).toThrow('does not belong')
  expect(() => priorPublicationReceipts([original], receipt.version, new Set(['stacks']))).toThrow('does not belong')
  const different = `sha512-${createHash('sha512').update('repacked release').digest('base64')}`
  expect(() => priorPublicationReceipts([original, provenanceUpload(different)], receipt.version, names)).toThrow('Conflicting original archive receipts')
})

test('public metadata never permits resumption with changed or unreadable archive bytes', async () => {
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    if (new URL(request.url).pathname.endsWith('.tgz')) return new Response('repacked release')
    return Response.json({ name: receipt.name, version: receipt.version,
      dist: { integrity: receipt.integrity, shasum: receipt.shasum,
        tarball: 'https://registry.npmjs.org/@stacksjs/enums/-/enums-0.75.260.tgz' } })
  } })
  try {
    await expect(verifyAcceptedPublications([receipt], {
      budgetMs: 60, pollMs: 5,
      read: (url, init) => fetch(new URL(new URL(url).pathname, server.url), init),
    })).rejects.toThrow('no publication resumed')
  }
  finally { await server.stop(true) }
})
