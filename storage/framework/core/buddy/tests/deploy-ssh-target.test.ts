import { describe, expect, it } from 'bun:test'
import {
  deployTargetLabel,
  dnsPublishingAllowed,
  hetznerTarget,
  isPrivateHost,
  isSshPipelineProvider,
  lanUrls,
  remoteExecOptions,
  resolveSshTarget,
  sshCliArgs,
  sshStatePin,
  toSshTarget,
} from '../src/commands/deploy-ssh-target'

/**
 * Deciding where an SSH deploy goes, and what it may do once it is there.
 *
 * Two things here are load-bearing beyond their size. The Hetzner argument list
 * has to stay exactly what the inline `execSync` calls built, or routing those
 * call sites through one helper quietly changes how every existing box is
 * reached. And a private address must never be publishable: an A record aimed
 * at 192.168.1.50 resolves, for every visitor, to whatever happens to sit at
 * that address on their own network.
 */

const pi = {
  ssh: {
    hosts: [{ host: 'pi-stacks.local', user: 'pi', privateKeyPath: '~/.ssh/id_ed25519' }],
    profile: 'raspberry-pi' as const,
  },
}

describe('isSshPipelineProvider', () => {
  it('claims the two providers that deploy by SSH', () => {
    expect(isSshPipelineProvider('hetzner')).toBe(true)
    expect(isSshPipelineProvider('ssh')).toBe(true)
  })

  it('leaves aws and anything unrecognised on the CloudFormation path', () => {
    expect(isSshPipelineProvider('aws')).toBe(false)
    expect(isSshPipelineProvider('digitalocean')).toBe(false)
    expect(isSshPipelineProvider(undefined)).toBe(false)
  })
})

describe('resolveSshTarget', () => {
  it('reads the first app host out of the config', () => {
    const target = resolveSshTarget(pi, { HOME: '/home/chris' })
    expect(target).toEqual({
      host: 'pi-stacks.local',
      user: 'pi',
      port: 22,
      identityFile: '/home/chris/.ssh/id_ed25519',
      profile: 'raspberry-pi',
      hostKey: 'pin',
    })
  })

  it('skips hosts declared for another role', () => {
    const config = { ssh: { hosts: [{ host: 'lb.local', role: 'lb' }, { host: 'app.local', role: 'app' }] } }
    expect(resolveSshTarget(config, {})?.host).toBe('app.local')
  })

  it('lets the environment override every field so CI needs no config edit', () => {
    const target = resolveSshTarget(pi, {
      TS_CLOUD_SSH_HOST: '10.0.0.9',
      TS_CLOUD_SSH_USER: 'deploy',
      TS_CLOUD_SSH_PORT: '2222',
      TS_CLOUD_SSH_KEY: '/keys/ci',
      TS_CLOUD_SSH_PROFILE: 'generic',
    })
    expect(target).toMatchObject({ host: '10.0.0.9', user: 'deploy', port: 2222, identityFile: '/keys/ci', profile: 'generic' })
  })

  it('defaults to root on 22 with the host key pinned', () => {
    const target = resolveSshTarget({ ssh: { hosts: [{ host: 'box.example.com' }] } }, {})
    expect(target).toMatchObject({ user: 'root', port: 22, hostKey: 'pin' })
    expect(target?.identityFile).toBeUndefined()
  })

  it('ignores a port that is not a usable number', () => {
    expect(resolveSshTarget(pi, { TS_CLOUD_SSH_PORT: 'nope' })?.port).toBe(22)
    expect(resolveSshTarget({ ssh: { hosts: [{ host: 'a.local', port: 0 }] } }, {})?.port).toBe(22)
  })

  it('returns null when no host is configured anywhere', () => {
    expect(resolveSshTarget({ ssh: { hosts: [] } }, {})).toBeNull()
    expect(resolveSshTarget(undefined, {})).toBeNull()
  })
})

describe('sshCliArgs', () => {
  it('reproduces the Hetzner argument list exactly', () => {
    // What the inline execSync call sites built before they shared this helper.
    expect(sshCliArgs(hetznerTarget('178.105.248.188'))).toEqual([
      '-o',
      'StrictHostKeyChecking=accept-new',
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=15',
      'root@178.105.248.188',
    ])
  })

  it('adds the port and key only when they differ from the defaults', () => {
    const target = { host: 'pi.local', user: 'pi', port: 2222, identityFile: '/keys/pi', profile: 'raspberry-pi' as const, hostKey: 'accept-new' as const }
    expect(sshCliArgs(target)).toEqual([
      '-o',
      'StrictHostKeyChecking=accept-new',
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=15',
      '-p',
      '2222',
      '-i',
      '/keys/pi',
      'pi@pi.local',
    ])
  })

  it('demands a verified host key once one has been pinned', () => {
    const target = { ...hetznerTarget('pi.local'), hostKey: 'pin' as const }
    const args = sshCliArgs(target, { knownHostsFile: '/s/known_hosts' })
    expect(args).toContain('StrictHostKeyChecking=yes')
    expect(args).toContain('UserKnownHostsFile=/s/known_hosts')
  })

  it('falls back to accept-new while a pin has nowhere to be recorded', () => {
    const target = { ...hetznerTarget('pi.local'), hostKey: 'pin' as const }
    expect(sshCliArgs(target)).toContain('StrictHostKeyChecking=accept-new')
  })

  it('honours an explicit connect timeout', () => {
    expect(sshCliArgs(hetznerTarget('1.2.3.4'), { connectTimeoutSec: 45 })).toContain('ConnectTimeout=45')
  })
})

describe('remoteExecOptions', () => {
  it('omits the port and key when they are the defaults', () => {
    expect(remoteExecOptions(hetznerTarget('1.2.3.4'))).toEqual({ user: 'root', connectTimeoutSec: 15 })
  })

  it('carries a non-standard port and an explicit key', () => {
    const target = { host: 'pi.local', user: 'pi', port: 2222, identityFile: '/k', profile: 'generic' as const, hostKey: 'pin' as const }
    expect(remoteExecOptions(target, 30)).toEqual({ user: 'pi', port: 2222, identityFile: '/k', connectTimeoutSec: 30 })
  })
})

describe('isPrivateHost', () => {
  const priv = ['10.0.0.1', '172.16.5.4', '172.31.255.255', '192.168.1.50', '127.0.0.1', '169.254.1.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', 'pi-stacks.local', 'raspberrypi', 'localhost', 'box.lan', 'db.internal', 'x.home.arpa', '']
  const pub = ['178.105.248.188', '8.8.8.8', '172.32.0.1', '172.15.0.1', '100.128.0.1', '2a01:4f8:c014:6186::1', 'stacksjs.com', 'pi.example.com']

  it.each(priv)('treats %s as private', (host) => {
    expect(isPrivateHost(host)).toBe(true)
  })

  it.each(pub)('treats %s as publishable', (host) => {
    expect(isPrivateHost(host)).toBe(false)
  })
})

describe('dnsPublishingAllowed', () => {
  const sites = { main: { domain: 'pi.example.com' } }

  it('never restricts the Hetzner path', () => {
    expect(dnsPublishingAllowed({ provider: 'hetzner', sites: {}, env: {} })).toBe(true)
  })

  it('publishes for an SSH host that has a public address and a domain', () => {
    expect(dnsPublishingAllowed({ provider: 'ssh', publicIp: '203.0.113.9', sites, env: {} })).toBe(true)
  })

  it('refuses to publish a private address', () => {
    expect(dnsPublishingAllowed({ provider: 'ssh', publicIp: '192.168.1.50', sites, env: {} })).toBe(false)
  })

  it('stays off when no site claims a domain', () => {
    expect(dnsPublishingAllowed({ provider: 'ssh', publicIp: '203.0.113.9', sites: { main: { port: 3000 } }, env: {} })).toBe(false)
  })

  it('can be forced on for a box behind a port forward this process cannot see', () => {
    expect(dnsPublishingAllowed({ provider: 'ssh', publicIp: '192.168.1.50', sites, env: { TS_CLOUD_SSH_PUBLISH_DNS: '1' } })).toBe(true)
  })

  it('can be forced off even when everything else says yes', () => {
    expect(dnsPublishingAllowed({ provider: 'ssh', publicIp: '203.0.113.9', sites, env: { TS_CLOUD_SSH_PUBLISH_DNS: '0' } })).toBe(false)
  })
})

describe('sshStatePin', () => {
  it('keeps publicIp populated so the shared target lookup needs no special case', () => {
    const pin = sshStatePin({ stackName: 'stacks-production', target: resolveSshTarget(pi, { HOME: '/h' })!, hostKeyFingerprint: 'SHA256:abc' })
    expect(pin).toMatchObject({
      provider: 'ssh',
      stackName: 'stacks-production',
      host: 'pi-stacks.local',
      publicIp: 'pi-stacks.local',
      sshUser: 'pi',
      sshPort: 22,
      profile: 'raspberry-pi',
      hostKeyFingerprint: 'SHA256:abc',
      deployStoragePath: '/var/ts-cloud/staging',
    })
    expect(pin.serverId).toBeUndefined()
  })
})

describe('lanUrls', () => {
  it('leads with the gateway name the local certificate covers', () => {
    const target = resolveSshTarget(pi, {})!
    expect(lanUrls({ main: { port: 3000 }, api: { port: 3008 } }, target)[0]).toBe('https://pi-stacks.local')
  })

  it('lists each site port, since only one name resolves over mDNS', () => {
    const target = resolveSshTarget(pi, {})!
    expect(lanUrls({ main: { port: 3000 }, docs: {} }, target)).toEqual(['https://pi-stacks.local', 'http://pi-stacks.local:3000'])
  })
})

describe('deployTargetLabel', () => {
  it('names the target the user recognises', () => {
    expect(deployTargetLabel('hetzner')).toBe('Hetzner Cloud')
    expect(deployTargetLabel('ssh', 'raspberry-pi')).toBe('Raspberry Pi over SSH')
    expect(deployTargetLabel('ssh', 'generic')).toBe('SSH host')
  })
})

describe('toSshTarget', () => {
  it('accepts the bare IP every existing call site still passes', () => {
    expect(toSshTarget('1.2.3.4')).toEqual(hetznerTarget('1.2.3.4'))
    const target = resolveSshTarget(pi, {})!
    expect(toSshTarget(target)).toBe(target)
  })
})
