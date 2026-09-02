import { describe, expect, it } from 'bun:test'
import { findCapability } from '@stacksjs/config'
import { resolveProvider } from '../src/commands/deploy'
import { isSshPipelineProvider } from '../src/commands/deploy-ssh-target'

/**
 * Which pipeline a deploy takes.
 *
 * `buddy deploy` has two of them and they share nothing: AWS builds a
 * CloudFormation stack, while Hetzner and a plain SSH host ship a tarball over
 * SSH. The fork is a single predicate, so the thing worth pinning is that it
 * keeps answering the same way for the providers that already existed. An
 * unrecognised provider must land on the AWS path rather than the SSH one,
 * because that is where it landed before there was a second SSH provider.
 */

describe('resolveProvider', () => {
  it('reads the provider out of the config', () => {
    expect(resolveProvider({ cloud: { provider: 'ssh' } })).toBe('ssh')
    expect(resolveProvider({ cloud: { provider: 'hetzner' } })).toBe('hetzner')
  })

  it('falls back to aws when nothing declares one', () => {
    const previous = process.env.CLOUD_PROVIDER
    delete process.env.CLOUD_PROVIDER
    try {
      expect(resolveProvider({})).toBe('aws')
      expect(resolveProvider(undefined)).toBe('aws')
    }
    finally {
      if (previous !== undefined)
        process.env.CLOUD_PROVIDER = previous
    }
  })

  it('lets CLOUD_PROVIDER stand in for a config that does not declare one', () => {
    const previous = process.env.CLOUD_PROVIDER
    process.env.CLOUD_PROVIDER = 'ssh'
    try {
      expect(resolveProvider({})).toBe('ssh')
      // The config still wins; the env var only fills a gap.
      expect(resolveProvider({ cloud: { provider: 'hetzner' } })).toBe('hetzner')
    }
    finally {
      if (previous === undefined)
        delete process.env.CLOUD_PROVIDER
      else
        process.env.CLOUD_PROVIDER = previous
    }
  })
})

describe('the deploy fork', () => {
  it('sends hetzner and ssh down the SSH pipeline', () => {
    expect(isSshPipelineProvider(resolveProvider({ cloud: { provider: 'hetzner' } }))).toBe(true)
    expect(isSshPipelineProvider(resolveProvider({ cloud: { provider: 'ssh' } }))).toBe(true)
  })

  it('leaves aws and anything unknown on the CloudFormation pipeline', () => {
    expect(isSshPipelineProvider(resolveProvider({ cloud: { provider: 'aws' } }))).toBe(false)
    expect(isSshPipelineProvider(resolveProvider({ cloud: { provider: 'linode' } }))).toBe(false)
  })
})

describe('the capability registry', () => {
  it('declares the ssh deploy target, with what it cannot do', () => {
    const capability = findCapability('deploy', 'ts-cloud-ssh')
    expect(capability?.status).toBe('experimental')
    expect(capability?.topology).toBe('ssh-box-systemd-rpx')
    expect(capability?.limitations.join(' ')).toContain('private address')
  })

  it('leaves the hetzner target exactly as it was', () => {
    expect(findCapability('deploy', 'ts-cloud-hetzner')?.topology).toBe('hetzner-vm-systemd-rpx')
  })
})
