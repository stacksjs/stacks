import { describe, expect, it } from 'bun:test'
import { deploymentRollbackInput } from './deployment-rollback'

describe('deployment rollback input', () => {
  it('normalizes a scoped rollback target', () => {
    expect(deploymentRollbackInput({ environment: 'Staging', site: 'Dashboard', release: 'Release-42' })).toEqual({
      environment: 'staging',
      site: 'dashboard',
      release: 'release-42',
    })
  })

  it('rejects shell syntax instead of forwarding it', () => {
    expect(() => deploymentRollbackInput({ environment: 'production; echo unsafe' })).toThrow()
  })
})
