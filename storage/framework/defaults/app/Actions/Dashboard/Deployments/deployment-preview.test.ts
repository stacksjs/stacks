import { describe, expect, it } from 'bun:test'
import type { DeploymentPreview } from '@stacksjs/types'
import { parseDeploymentPreview } from './deployment-preview'

const plan: DeploymentPreview = {
  version: 1,
  dryRun: true,
  project: { name: 'Acme', slug: 'acme' },
  provider: 'hetzner',
  mode: 'server',
  environment: 'production',
  region: 'us-east-1',
  target: { site: null, domain: null, attachTo: null },
  sites: [],
  operations: [],
  warnings: [],
}

describe('dashboard deployment preview process', () => {
  it('extracts the versioned contract from Buddy output', () => {
    const output = `[env] loaded\nSTACKS_DEPLOY_PREVIEW_JSON=${JSON.stringify(plan)}\n`
    expect(parseDeploymentPreview(output)).toEqual(plan)
  })

  it('rejects missing and malformed preview contracts', () => {
    expect(() => parseDeploymentPreview('ordinary output')).toThrow('did not return')
    expect(() => parseDeploymentPreview('STACKS_DEPLOY_PREVIEW_JSON={}')).toThrow('invalid')
  })
})
