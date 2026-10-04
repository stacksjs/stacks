/**
 * `visibility()` reads the object ACL that ts-cloud's `getObjectAcl` returns:
 * the parsed `<AccessControlPolicy>` body, with grants at
 * `AccessControlList.Grant` (an object for one grant, an array for several).
 *
 * It used to read the AWS SDK's `Grants` array, which that body never has, so a
 * `public-read` object reported `'private'`. Older ts-cloud returned undefined
 * here outright, which hid the wrong field name behind the same answer.
 */

import { describe, expect, it } from 'bun:test'
import { S3StorageAdapter } from '../src/adapters/s3'

const ALL_USERS = 'http://acs.amazonaws.com/groups/global/AllUsers'
const owner = { Grantee: { ID: 'owner' }, Permission: 'FULL_CONTROL' }

function adapterReturning(acl: unknown): S3StorageAdapter {
  const client = { getObjectAcl: async () => acl }
  return new S3StorageAdapter(client as any, { bucket: 'assets' } as any)
}

describe('S3StorageAdapter.visibility', () => {
  it('is public when an AllUsers READ grant sits beside the owner grant', async () => {
    const acl = { Owner: { ID: 'owner' }, AccessControlList: { Grant: [owner, { Grantee: { URI: ALL_USERS }, Permission: 'READ' }] } }
    expect(await adapterReturning(acl).visibility('img/logo.png')).toBe('public')
  })

  it('is public when the AllUsers grant is the only one (a single Grant parses as an object)', async () => {
    const acl = { AccessControlList: { Grant: { Grantee: { URI: ALL_USERS }, Permission: 'FULL_CONTROL' } } }
    expect(await adapterReturning(acl).visibility('img/logo.png')).toBe('public')
  })

  it('is private with only the owner grant', async () => {
    const acl = { Owner: { ID: 'owner' }, AccessControlList: { Grant: owner } }
    expect(await adapterReturning(acl).visibility('img/logo.png')).toBe('private')
  })

  it('is private when AllUsers can only write, not read', async () => {
    const acl = { AccessControlList: { Grant: [owner, { Grantee: { URI: ALL_USERS }, Permission: 'WRITE' }] } }
    expect(await adapterReturning(acl).visibility('img/logo.png')).toBe('private')
  })

  it('is private when the client returns nothing', async () => {
    expect(await adapterReturning(undefined).visibility('img/logo.png')).toBe('private')
  })
})
