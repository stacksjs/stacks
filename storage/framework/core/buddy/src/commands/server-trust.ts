/**
 * Trusting the certificate authority a LAN box signs its own certificate with.
 *
 * A box configured with `ssh.lan.tls: 'local-ca'` runs its own authority and
 * signs the gateway certificate itself. Nothing off the box trusts that
 * authority until somebody installs it, so `buddy server:trust` fetches the
 * certificate and hands it to the local trust store.
 *
 * The pieces that can be wrong without a box being involved live here, pure, so
 * they can be tested: where the certificate is expected to be, where the local
 * copy is written, how a path reaches a remote shell, and what the `--json`
 * summary promises. The parts that need a network are in `server.ts`.
 */

import { join } from 'node:path'
import process from 'node:process'

/**
 * Where rpx writes the authority on a box that issues its own LAN certificate.
 *
 * ts-cloud configures rpx with `localCa.dir` at `/etc/rpx/local-ca`, and rpx
 * names the root `rpx-root-ca.crt` inside it. This is a convention rather than
 * something either side reports, which is why `--ca-path` exists.
 */
export const DEFAULT_LAN_CA_PATH = '/etc/rpx/local-ca/rpx-root-ca.crt'

/**
 * The exit status the remote read uses for "the file is not there".
 *
 * A missing authority and an unreachable box need different advice, and `cat`
 * cannot tell them apart on its own: both come back as a non-zero ssh. Picking
 * a status no shell assigns on its own keeps the two distinguishable.
 */
export const CA_MISSING_EXIT = 44

/** The certificate path to read on the host, honouring an explicit override. */
export function resolveCaPath(flag?: string | null): string {
  const value = typeof flag === 'string' ? flag.trim() : ''
  return value || DEFAULT_LAN_CA_PATH
}

/**
 * A host as it can safely appear in a filename.
 *
 * A host is whatever the config says, so it can be an IPv6 literal, and it is
 * about to be part of a path this command creates. Anything outside the set a
 * hostname or an address needs becomes a hyphen, which keeps `../` and a colon
 * out of the result without silently mapping two different hosts onto one file.
 */
export function caFileSlug(host: string): string {
  const slug = String(host ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '')
  return slug || 'host'
}

/**
 * Where this machine keeps its copy of a host's authority.
 *
 * Under `storage/cloud/` with the rest of the deploy state, keyed by host, so a
 * second run and a second board do not overwrite each other and the user has a
 * file to point a browser, a phone or `curl --cacert` at afterwards.
 */
export function caCopyPath(host: string, projectRoot: string = process.cwd()): string {
  return join(projectRoot, 'storage', 'cloud', 'ssh', `${caFileSlug(host)}.ca.crt`)
}

/** A single-quoted argument for a remote `sh`, safe for any byte but NUL. */
export function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

/**
 * The remote script that reads the authority.
 *
 * The file is readable by everyone on most boxes, but the directory it sits in
 * need not be, so an unreadable-but-present file falls back to a non-interactive
 * sudo. `sudo -n` rather than `sudo`: the deploy runs with `BatchMode=yes` and
 * no terminal, and a sudo that prompts would hang rather than fail.
 */
export function caReadScript(caPath: string): string {
  const path = shellQuote(caPath)
  return [
    `if [ -r ${path} ]; then cat ${path}; exit 0; fi`,
    `if [ -e ${path} ]; then sudo -n cat ${path}; exit $?; fi`,
    `exit ${CA_MISSING_EXIT}`,
  ].join('\n')
}

/** What `--json` prints, and what the human output says in prose. */
export interface TrustSummary {
  host: string
  /** Where the authority lives on the host. */
  caPath: string
  /** Where this machine saved its copy. */
  savedPath: string
  /** SHA-256 of the certificate, uppercase hex, no separators. */
  fingerprint: string
  /** Whether this machine's trust store holds it now. */
  trusted: boolean
  /** Only present when a configuration profile was written. */
  mobileconfigPath?: string
}

/**
 * The summary, with the profile path present only when one was actually written.
 *
 * A `mobileconfigPath` of null in the JSON would read as "a profile, at nowhere".
 * Omitting the key says the same thing without inviting a consumer to use it.
 */
export function trustSummary(input: {
  host: string
  caPath: string
  savedPath: string
  fingerprint: string
  trusted: boolean
  mobileconfigPath?: string | null
}): TrustSummary {
  return {
    host: input.host,
    caPath: input.caPath,
    savedPath: input.savedPath,
    fingerprint: input.fingerprint,
    trusted: input.trusted === true,
    ...(input.mobileconfigPath ? { mobileconfigPath: input.mobileconfigPath } : {}),
  }
}

/** The steps that get a profile onto an iPhone, including the one people miss. */
export function mobileconfigInstructions(profilePath: string): string[] {
  return [
    `Send ${profilePath} to the device by AirDrop, mail or a link, then open it.`,
    'Install it under Settings > General > VPN & Device Management.',
    'Turn on full trust under Settings > General > About > Certificate Trust Settings.',
    'The last step is not optional. A profile that is installed but not fully trusted still fails, and the symptom looks like a bad certificate.',
  ]
}
