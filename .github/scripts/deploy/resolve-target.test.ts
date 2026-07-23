import { describe, expect, it } from 'bun:test'
import { resolveDeploymentTarget } from './resolve-target'

describe('push-to-deploy target resolution', () => {
  it('maps main to the only provisioned production target', () => {
    expect(resolveDeploymentTarget('refs/heads/main')).toEqual({ environment: 'production', flag: '--prod' })
  })

  it('does not imply unprovisioned environments or tag deployments', () => {
    expect(resolveDeploymentTarget('refs/heads/stage')).toBeUndefined()
    expect(resolveDeploymentTarget('refs/heads/dev')).toBeUndefined()
    expect(resolveDeploymentTarget('refs/tags/v1.0.0-beta.1')).toBeUndefined()
  })
})
