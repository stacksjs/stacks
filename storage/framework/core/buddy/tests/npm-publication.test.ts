import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { acceptedPublications, publicationMatchesOriginal } from '../../../../../.github/scripts/npm-publication'

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
