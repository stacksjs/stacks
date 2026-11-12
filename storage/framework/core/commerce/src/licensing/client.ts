/**
 * The client half of licensing, for a desktop app's agent.
 *
 * It talks to the framework's license routes (`/licenses/activate`,
 * `/licenses/check`, `/licenses/deactivate`), keeps the key and the signed
 * offline token in storage the app supplies, and answers one question with
 * no network: is this build licensed, and are its paid features unlocked?
 *
 * Imports only `./token` (which imports only `node:crypto`), so it compiles
 * into a Bun agent without the server's models:
 *
 * ```ts
 * import { createLicenseClient } from '@stacksjs/commerce/licensing/client'
 *
 * const license = createLicenseClient({
 *   endpoint: 'https://example.com/licenses',
 *   publicKeys: { 'license-2026-11-11': 'ed25519-public:...' },
 *   buildDate: BUILD_DATE,
 *   storage: {
 *     get: name => Bun.secrets.get({ service: 'com.example.app', name }),
 *     set: (name, value) => Bun.secrets.set({ service: 'com.example.app', name, value }),
 *     delete: async (name) => { await Bun.secrets.delete({ service: 'com.example.app', name }) },
 *   },
 * })
 * ```
 */

import type { LicensePublicKeys, LicenseTier, LicenseTokenPayload, TokenStandingReason } from './token'
import { hashDeviceId, LicenseTokenError, tokenStanding, verifyLicenseToken } from './token'

export { hashDeviceId, isEntitled, LicenseTokenError, OFFLINE_GRACE_DAYS, RECHECK_DAYS, tokenStanding } from './token'
export type { LicensePublicKeys, LicenseTier, LicenseTokenPayload, TokenStanding } from './token'

type MaybePromise<T> = T | Promise<T>

/** Where the key and token are kept. Back it with `Bun.secrets`, a keychain, or a file. */
export interface LicenseStorage {
  get: (name: string) => MaybePromise<string | null | undefined>
  set: (name: string, value: string) => MaybePromise<unknown>
  delete: (name: string) => MaybePromise<unknown>
}

export interface LicenseDevice {
  /** A stable id for this machine. Only its SHA-256 leaves the device. */
  id: string
  /** Shown to the owner when the device limit is reached: "Chris's MacBook Pro". */
  name?: string
  /** `darwin`, `linux` or `win32`. */
  platform?: string
  appVersion?: string
  /** For a team license: the address of the seat this person holds. */
  email?: string
}

export type LicenseFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface LicenseClientOptions {
  /** The license routes' base URL, such as `https://example.com/licenses`. */
  endpoint: string
  /** Key id to `ed25519-public:` key. The public half of the server's signing key. */
  publicKeys: LicensePublicKeys
  storage: LicenseStorage
  /** When the running build was released. What `updatesUntil` is compared with. */
  buildDate: Date | string
  fetcher?: LicenseFetcher
  now?: () => Date
  /** The name the state is stored under. Defaults to `license`. */
  storageName?: string
}

/** A device already using the license, as the server names it. */
export interface LicenseDeviceInUse {
  name: string | null
  platform: string | null
  lastSeenAt: string | null
}

export type LicenseStandingReason =
  | TokenStandingReason
  | 'unlicensed'
  | 'invalid-token'
  | 'revoked'
  | 'refunded'
  | 'released'

/** What the app acts on. `pro` is the only field a feature gate needs. */
export interface LicenseStanding {
  licensed: boolean
  /** Paid features are unlocked for the running build. */
  pro: boolean
  tier: LicenseTier | null
  reason: LicenseStandingReason
  /** The last release date this license unlocks, or null for every build. */
  updatesUntil: string | null
  expiresAt: string | null
  lastCheckedAt: string | null
  /** The answer came from the stored token because the server could not be reached. */
  offline: boolean
}

export type ActivateResult =
  | { ok: true, standing: LicenseStanding }
  | { ok: false, reason: string, message: string, devices?: LicenseDeviceInUse[] }

export interface LicenseClient {
  /** Activate a key on this device and store the token. Refused beyond the device limit, naming the devices in use. */
  activate: (key: string, device: LicenseDevice) => Promise<ActivateResult>
  /** Give this device's slot back and forget the license here. */
  release: () => Promise<{ ok: boolean, message?: string }>
  /**
   * Where the license stands. Reads the stored token; asks the server again
   * when a check is due and `online` is not false. Never throws for a network
   * failure: the stored token answers instead.
   */
  standing: (options?: { online?: boolean, force?: boolean }) => Promise<LicenseStanding>
  /** The payload of a token this app trusts, or a {@link LicenseTokenError}. */
  verifyToken: (token: string) => LicenseTokenPayload
}

interface StoredLicense {
  key: string
  deviceId: string
  token: string
  lastCheckedAt: string
  email?: string
}

const UNLICENSED: LicenseStanding = {
  licensed: false,
  pro: false,
  tier: null,
  reason: 'unlicensed',
  updatesUntil: null,
  expiresAt: null,
  lastCheckedAt: null,
  offline: false,
}

/** The payload of a token signed by one of `publicKeys`. Throws a {@link LicenseTokenError} otherwise. */
export function verifyToken(token: string, publicKeys: LicensePublicKeys, deviceHash?: string): LicenseTokenPayload {
  return verifyLicenseToken(token, publicKeys, deviceHash)
}

export function createLicenseClient(options: LicenseClientOptions): LicenseClient {
  const fetcher = options.fetcher ?? fetch
  const now = options.now ?? (() => new Date())
  const name = options.storageName ?? 'license'
  const endpoint = options.endpoint.replace(/\/+$/, '')

  async function load(): Promise<StoredLicense | null> {
    const raw = await options.storage.get(name)
    if (!raw)
      return null
    try {
      const state = JSON.parse(raw) as StoredLicense
      return typeof state?.key === 'string' && typeof state.deviceId === 'string' && typeof state.token === 'string' ? state : null
    }
    catch {
      return null
    }
  }

  async function post(path: string, body: Record<string, unknown>): Promise<{ status: number, data: Record<string, any> }> {
    const response = await fetcher(`${endpoint}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    })
    let data: Record<string, any> = {}
    try {
      data = await response.json() as Record<string, any>
    }
    catch {
      data = {}
    }
    return { status: response.status, data }
  }

  function read(state: StoredLicense, offline: boolean): LicenseStanding {
    let payload: LicenseTokenPayload
    try {
      payload = verifyLicenseToken(state.token, options.publicKeys, hashDeviceId(state.deviceId))
    }
    catch (error) {
      if (!(error instanceof LicenseTokenError))
        throw error
      return { ...UNLICENSED, reason: 'invalid-token', lastCheckedAt: state.lastCheckedAt, offline }
    }
    const standing = tokenStanding(payload, { buildDate: options.buildDate, now: now(), lastCheckedAt: state.lastCheckedAt })
    return {
      licensed: standing.licensed,
      pro: standing.pro,
      tier: payload.tier,
      reason: standing.reason,
      updatesUntil: payload.updatesUntil,
      expiresAt: payload.expiresAt,
      lastCheckedAt: state.lastCheckedAt,
      offline,
    }
  }

  function recheckDue(state: StoredLicense): boolean {
    try {
      const payload = verifyLicenseToken(state.token, options.publicKeys, hashDeviceId(state.deviceId))
      return tokenStanding(payload, { buildDate: options.buildDate, now: now(), lastCheckedAt: state.lastCheckedAt }).recheckDue
    }
    catch {
      // A token that no longer verifies (a rotated key) is worth one more ask.
      return true
    }
  }

  return {
    verifyToken: token => verifyLicenseToken(token, options.publicKeys),

    async activate(key, device) {
      let answer
      try {
        answer = await post('/activate', {
          key,
          deviceHash: hashDeviceId(device.id),
          deviceName: device.name ?? null,
          platform: device.platform ?? null,
          appVersion: device.appVersion ?? null,
          ...(device.email ? { email: device.email } : {}),
        })
      }
      catch (error) {
        return { ok: false, reason: 'network', message: `The license server could not be reached: ${error instanceof Error ? error.message : String(error)}` }
      }
      const { data } = answer
      if (!data.ok || typeof data.token !== 'string') {
        return {
          ok: false,
          reason: typeof data.reason === 'string' ? data.reason : 'failed',
          message: typeof data.message === 'string' ? data.message : `Activation failed with HTTP ${answer.status}`,
          ...(Array.isArray(data.devices) ? { devices: data.devices as LicenseDeviceInUse[] } : {}),
        }
      }

      const state: StoredLicense = {
        key: typeof data.key === 'string' ? data.key : key,
        deviceId: device.id,
        token: data.token,
        lastCheckedAt: now().toISOString(),
        ...(device.email ? { email: device.email } : {}),
      }
      const standing = read(state, false)
      // A token this build cannot verify is a wrong public key, not a license.
      if (standing.reason === 'invalid-token')
        return { ok: false, reason: 'invalid-token', message: 'The server answered with a license token this build does not trust.' }
      await options.storage.set(name, JSON.stringify(state))
      return { ok: true, standing }
    },

    async release() {
      const state = await load()
      if (!state)
        return { ok: true }
      try {
        const { data, status } = await post('/deactivate', { key: state.key, deviceHash: hashDeviceId(state.deviceId) })
        if (!data.ok && status !== 404)
          return { ok: false, message: typeof data.message === 'string' ? data.message : `Release failed with HTTP ${status}` }
      }
      catch (error) {
        // The slot is only free once the server knows, so keep the license here.
        return { ok: false, message: `The license server could not be reached: ${error instanceof Error ? error.message : String(error)}` }
      }
      await options.storage.delete(name)
      return { ok: true }
    },

    async standing(request = {}) {
      const state = await load()
      if (!state)
        return UNLICENSED
      if (request.online === false || !(request.force || recheckDue(state)))
        return read(state, request.online === false)

      let answer
      try {
        answer = await post('/check', { key: state.key, deviceHash: hashDeviceId(state.deviceId) })
      }
      catch {
        return read(state, true)
      }
      const { data, status } = answer
      // Only a definite answer changes anything. A 5xx or a proxy's error page
      // is the server being unreachable by another name.
      if (status >= 500 || typeof data.ok !== 'boolean')
        return read(state, true)

      if (data.ok && data.valid === true && typeof data.token === 'string') {
        const next: StoredLicense = { ...state, token: data.token, lastCheckedAt: now().toISOString() }
        const standing = read(next, false)
        if (standing.reason === 'invalid-token')
          return read(state, true)
        await options.storage.set(name, JSON.stringify(next))
        return standing
      }

      // The server knows the license and says no: revoked, refunded, or this
      // device was released from another one.
      if (data.valid === false || status === 403 || status === 404) {
        await options.storage.delete(name)
        const reason = ['revoked', 'refunded', 'released', 'expired'].includes(data.reason) ? data.reason as LicenseStandingReason : 'unlicensed'
        return { ...UNLICENSED, reason }
      }
      return read(state, true)
    },
  }
}
