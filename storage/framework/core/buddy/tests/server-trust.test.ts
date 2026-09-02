import { describe, expect, it } from 'bun:test'
import {
  CA_MISSING_EXIT,
  caCopyPath,
  caFileSlug,
  caReadScript,
  DEFAULT_LAN_CA_PATH,
  mobileconfigInstructions,
  resolveCaPath,
  shellQuote,
  trustSummary,
} from '../src/commands/server-trust'

/**
 * Where the board's certificate authority is, and where the copy of it lands.
 *
 * `buddy server:trust` installs a certificate into the system trust store, so
 * the parts worth pinning are the ones that decide WHICH file that is. A
 * default path that drifts from what rpx writes turns into "there is no
 * authority on this host" against a host that has one, and a local copy path
 * that collapses two hosts onto one file means trusting board B after board A
 * silently trusts A's certificate again.
 */

describe('the certificate path on the host', () => {
  it('defaults to where rpx writes the local authority', () => {
    // ts-cloud configures rpx with localCa.dir = /etc/rpx/local-ca, and rpx
    // names the root inside it. Neither side reports the path at run time, so
    // this constant is the whole agreement.
    expect(DEFAULT_LAN_CA_PATH).toBe('/etc/rpx/local-ca/rpx-root-ca.crt')
    expect(resolveCaPath()).toBe(DEFAULT_LAN_CA_PATH)
  })

  it('uses --ca-path when one is given', () => {
    expect(resolveCaPath('/srv/pki/root.crt')).toBe('/srv/pki/root.crt')
  })

  it('falls back to the default for a flag that carries no path', () => {
    // An empty --ca-path is a shell accident (`--ca-path "$CA"` with CA unset),
    // and reading `''` off the host would report the authority as missing on a
    // host that has one. The default is the better answer than a confident lie.
    expect(resolveCaPath('')).toBe(DEFAULT_LAN_CA_PATH)
    expect(resolveCaPath('   ')).toBe(DEFAULT_LAN_CA_PATH)
    expect(resolveCaPath(undefined)).toBe(DEFAULT_LAN_CA_PATH)
  })
})

describe('the local copy', () => {
  it('is written under the deploy state directory, keyed by host', () => {
    expect(caCopyPath('pi-stacks.local', '/work/app'))
      .toBe('/work/app/storage/cloud/ssh/pi-stacks.local.ca.crt')
  })

  it('keeps two boards apart', () => {
    const first = caCopyPath('pi-stacks.local', '/work/app')
    const second = caCopyPath('pi-spare.local', '/work/app')
    expect(first).not.toBe(second)
  })

  it('cannot be steered out of the state directory by the host name', () => {
    // The host comes from config or --discover, and is about to become part of
    // a path this command creates. A host of '../../.ssh/authorized_keys'
    // must stay inside storage/cloud/ssh rather than escaping it.
    const path = caCopyPath('../../.ssh/authorized_keys', '/work/app')
    expect(path.startsWith('/work/app/storage/cloud/ssh/')).toBe(true)
    expect(path).not.toContain('..')
  })

  it('gives an IPv6 host a name a filesystem accepts', () => {
    expect(caFileSlug('fe80::1')).toBe('fe80-1')
    expect(caFileSlug('192.168.1.42')).toBe('192.168.1.42')
  })
})

describe('reading the certificate off the host', () => {
  it('separates "no authority here" from every other failure', () => {
    // A missing file and an unreachable board both arrive as a non-zero ssh,
    // and they want opposite advice: configure LAN TLS, versus check the
    // network. The script reserves a status no shell hands out on its own.
    const script = caReadScript(DEFAULT_LAN_CA_PATH)
    expect(script).toContain(`exit ${CA_MISSING_EXIT}`)
    expect(CA_MISSING_EXIT).toBeGreaterThan(2)
  })

  it('reads rather than writes', () => {
    // This command must never create anything on the box: a user running it
    // against a host with no authority should get a message, not a new CA.
    const script = caReadScript(DEFAULT_LAN_CA_PATH)
    expect(script).toContain('cat')
    expect(script).not.toMatch(/\b(?:tee|mkdir|touch|openssl|rm)\b/)
  })

  it('quotes the path so a --ca-path cannot smuggle in a second command', () => {
    // The path is typed by the user and interpolated into a remote shell. Run
    // the script through a local `sh` against a path that would print a marker
    // if the quoting leaked: the read fails harmlessly, and the marker must
    // never appear.
    const script = caReadScript(`/nonexistent-ca'; echo PWNED; :'`)
    const ran = Bun.spawnSync(['sh'], { stdin: new TextEncoder().encode(script) })

    expect(new TextDecoder().decode(ran.stdout)).not.toContain('PWNED')
    expect(ran.exitCode).toBe(CA_MISSING_EXIT)
  })

  it('escapes a quote rather than ending the argument at it', () => {
    expect(shellQuote(`it's`)).toBe(`'it'\\''s'`)
  })
})

describe('the --json summary', () => {
  const base = {
    host: 'pi-stacks.local',
    caPath: DEFAULT_LAN_CA_PATH,
    savedPath: '/work/app/storage/cloud/ssh/pi-stacks.local.ca.crt',
    fingerprint: 'A1B2C3D4E5F60718293A4B5C6D7E8F901122334455667788990AABBCCDDEEFF0',
    trusted: true,
  }

  it('reports the host, both paths, the fingerprint and the trust state', () => {
    expect(trustSummary(base)).toEqual({
      host: 'pi-stacks.local',
      caPath: '/etc/rpx/local-ca/rpx-root-ca.crt',
      savedPath: '/work/app/storage/cloud/ssh/pi-stacks.local.ca.crt',
      fingerprint: 'A1B2C3D4E5F60718293A4B5C6D7E8F901122334455667788990AABBCCDDEEFF0',
      trusted: true,
    })
  })

  it('never carries the certificate itself', () => {
    // The summary is printed to a terminal and piped into other tools. It
    // identifies the certificate by fingerprint; the bytes stay in the file.
    const json = JSON.stringify(trustSummary(base))
    expect(json).not.toContain('BEGIN CERTIFICATE')
  })

  it('omits the profile path rather than reporting a profile at nowhere', () => {
    expect(trustSummary(base)).not.toHaveProperty('mobileconfigPath')
    expect(trustSummary({ ...base, mobileconfigPath: undefined })).not.toHaveProperty('mobileconfigPath')
  })

  it('carries the profile path when one was written', () => {
    expect(trustSummary({ ...base, mobileconfigPath: '/tmp/pi.mobileconfig' }).mobileconfigPath)
      .toBe('/tmp/pi.mobileconfig')
  })

  it('says trusted only when it is a boolean true', () => {
    // A consumer branches on this field. `trusted` must never come back as the
    // truthy-but-unanswered value some trust-store report might hand over.
    expect(trustSummary({ ...base, trusted: undefined as unknown as boolean }).trusted).toBe(false)
  })
})

describe('the iOS instructions', () => {
  it('include the full-trust step, which is the one people skip', () => {
    // Installing the profile alone leaves Safari rejecting the certificate,
    // and the symptom looks like the certificate is wrong rather than untrusted.
    const steps = mobileconfigInstructions('/tmp/pi.mobileconfig')
    expect(steps.join('\n')).toContain('Certificate Trust Settings')
    expect(steps.some(step => step.includes('/tmp/pi.mobileconfig'))).toBe(true)
  })

  it('uses no em-dashes, which the project bans in user-visible output', () => {
    expect(mobileconfigInstructions('/tmp/pi.mobileconfig').join('\n')).not.toMatch(/[–—]/)
  })
})
