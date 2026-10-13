/**
 * fiskaly SIGN DE (API v2): a cloud TSE (technische Sicherheitseinrichtung)
 * that signs every till transaction, as Germany's KassenSichV (§ 146a AO)
 * requires of an electronic till. Also `@stacksjs/commerce/fiskaly`.
 *
 * The calls follow fiskaly's public API reference
 * (https://developer.fiskaly.com/api/kassensichv/v2):
 *
 * - `POST /auth` trades an API key and secret for a bearer token (refreshed
 *   with its `refresh_token` before it runs out);
 * - a TSS (one TSE) is created with `PUT /tss/{id}` (state CREATED, answering
 *   the admin PUK once), personalised (`PATCH` state UNINITIALIZED), given an
 *   admin PIN with the PUK (`PATCH /tss/{id}/admin`), and initialised
 *   (`PATCH` state INITIALIZED) while the admin is signed in
 *   (`POST /tss/{id}/admin/auth`);
 * - a client (one till) is registered with `PUT /tss/{id}/client/{client_id}`;
 * - a transaction is started (`PUT /tss/{id}/tx/{tx_id}?tx_revision=1`, state
 *   ACTIVE) and finished (revision 2, state FINISHED, with the receipt's
 *   amounts per VAT rate and per payment type), which answers the signature,
 *   its counter, the times and the receipt's QR code data;
 * - an error is `{ status_code, error, code, message }`.
 *
 * Ids are UUIDs the caller chooses, so every call is a PUT that can be
 * repeated after a lost answer. `provisionTss` walks a TSS from nothing (or
 * from wherever an earlier attempt stopped) to INITIALIZED with a client.
 *
 * Nothing here is a certification: whether a till is compliant depends on
 * the whole system and its operator. The pure receipt and export rules are
 * in `kassensichv.ts` and `dsfinvk.ts`.
 */

export const FISKALY_SIGN_DE_URL = 'https://kassensichv-middleware.fiskaly.com/api/v2'

export type FiskalyFailure = 'rejected' | 'not_found' | 'conflict' | 'invalid' | 'rate_limited' | 'unreachable' | 'failed'

export class FiskalyError extends Error {
  constructor(message: string, readonly failure: FiskalyFailure, readonly status: number, readonly code: string | null = null) {
    super(message)
    this.name = 'FiskalyError'
  }

  /** The TSE could not be reached or failed on its side: a sale goes on unsigned and is marked. */
  get outage(): boolean {
    return this.failure === 'unreachable' || this.failure === 'rate_limited' || (this.failure === 'failed' && (this.status === 0 || this.status >= 500))
  }
}

export interface FiskalyCredentials {
  apiKey: string
  apiSecret: string
}

export interface FiskalyOptions extends FiskalyCredentials {
  baseUrl?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

export type TssState = 'CREATED' | 'UNINITIALIZED' | 'INITIALIZED' | 'DISABLED' | 'DEFECTIVE' | 'DELETED' | 'EVICTED'

export interface FiskalyTss {
  _id: string
  state: TssState
  description?: string
  serial_number?: string
  public_key?: string
  certificate?: string
  signature_algorithm?: string
  signature_timestamp_format?: string
  transaction_data_encoding?: string
  /** Only in the answer that created the TSS. */
  admin_puk?: string
  max_number_registered_clients?: number
  number_registered_clients?: number
  metadata?: Record<string, string>
}

export interface FiskalyClient {
  _id: string
  serial_number: string
  state: 'REGISTERED' | 'DEREGISTERED'
  tss_id: string
}

export type FiskalyVatRate = 'NORMAL' | 'REDUCED_1' | 'SPECIAL_RATE_1' | 'SPECIAL_RATE_2' | 'NULL'
export type FiskalyPaymentType = 'CASH' | 'NON_CASH'
export type FiskalyReceiptType = 'RECEIPT' | 'TRAINING' | 'TRANSFER' | 'ORDER' | 'CANCELLATION' | 'ABORT' | 'BENEFIT_IN_KIND' | 'INVOICE' | 'OTHER'

export interface FiskalyReceipt {
  receipt_type: FiskalyReceiptType
  amounts_per_vat_rate: Array<{ vat_rate: FiskalyVatRate, amount: string }>
  amounts_per_payment_type: Array<{ payment_type: FiskalyPaymentType, amount: string, currency_code?: string }>
}

export interface FiskalyTransaction {
  _id: string
  state: 'ACTIVE' | 'FINISHED' | 'CANCELLED'
  number: number
  client_id: string
  client_serial_number: string
  tss_id: string
  tss_serial_number: string
  time_start: number
  time_end?: number
  revision: number
  latest_revision: number
  qr_code_data?: string
  /** `counter` is documented as a string and sent as a number: read it with Number(). */
  signature?: { value: string, algorithm: string, counter: number | string, public_key: string }
  log?: { operation: string, timestamp: number, timestamp_format: string }
  schema?: { standard_v1?: { receipt?: FiskalyReceipt } }
}

function failureFor(status: number): FiskalyFailure {
  if (status === 401 || status === 403) return 'rejected'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 400 || status === 422) return 'invalid'
  if (status === 429) return 'rate_limited'
  return 'failed'
}

interface Token { accessToken: string, refreshToken: string | null, expiresAt: number }

/** A fiskaly SIGN DE client for one API key. Tokens are cached and refreshed. */
export function fiskalySignDe(options: FiskalyOptions) {
  const base = (options.baseUrl || FISKALY_SIGN_DE_URL).replace(/\/$/, '')
  const doFetch = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? 15_000
  let token: Token | null = null

  async function send(method: string, path: string, body: unknown, bearer: string | null, timeout = timeoutMs): Promise<{ status: number, json: any }> {
    let res: Response
    try {
      res = await doFetch(`${base}${path}`, {
        method,
        headers: {
          'Accept': 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      })
    }
    catch (error) {
      throw new FiskalyError(`Could not reach fiskaly: ${error instanceof Error ? error.message : String(error)}`, 'unreachable', 0)
    }
    const text = await res.text()
    let json: any = null
    try { json = text ? JSON.parse(text) : null }
    catch { json = null }
    if (!res.ok) {
      const message = typeof json?.message === 'string' && json.message ? json.message : `fiskaly answered ${res.status}`
      throw new FiskalyError(message, failureFor(res.status), res.status, typeof json?.code === 'string' ? json.code : null)
    }
    return { status: res.status, json }
  }

  function keep(json: any): Token {
    const expiresIn = Number(json?.access_token_expires_in)
    const expiresAt = Number(json?.access_token_expires_at)
    token = {
      accessToken: String(json?.access_token || ''),
      refreshToken: typeof json?.refresh_token === 'string' ? json.refresh_token : null,
      expiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt * 1000 : Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 300) * 1000,
    }
    if (!token.accessToken) throw new FiskalyError('fiskaly answered no access token', 'failed', 200)
    return token
  }

  /** A bearer token, refreshed a minute before it runs out. */
  async function bearer(): Promise<string> {
    if (token && token.expiresAt - 60_000 > Date.now()) return token.accessToken
    if (token?.refreshToken) {
      try {
        return keep((await send('POST', '/auth', { refresh_token: token.refreshToken }, null)).json).accessToken
      }
      catch (error) {
        if (!(error instanceof FiskalyError) || error.failure !== 'rejected') throw error
      }
    }
    return keep((await send('POST', '/auth', { api_key: options.apiKey, api_secret: options.apiSecret }, null)).json).accessToken
  }

  async function call<T = any>(method: 'GET' | 'PUT' | 'PATCH' | 'POST', path: string, body?: unknown, timeout?: number): Promise<T> {
    try {
      return (await send(method, path, body, await bearer(), timeout)).json as T
    }
    catch (error) {
      // A token revoked early: sign in again once.
      if (error instanceof FiskalyError && error.status === 401 && token) {
        token = null
        return (await send(method, path, body, await bearer(), timeout)).json as T
      }
      throw error
    }
  }

  const id = (value: string): string => encodeURIComponent(value)

  return {
    /** Checks the key and secret: fiskaly answers a token or 401. */
    async authenticate(): Promise<{ organizationId: string | null, environment: string | null }> {
      token = null
      const json = (await send('POST', '/auth', { api_key: options.apiKey, api_secret: options.apiSecret }, null)).json
      keep(json)
      const claims = json?.access_token_claims ?? {}
      return { organizationId: typeof claims.organization_id === 'string' ? claims.organization_id : null, environment: typeof claims.env === 'string' ? claims.env : null }
    },
    createTss: (tssId: string, metadata?: Record<string, string>) => call<FiskalyTss>('PUT', `/tss/${id(tssId)}`, metadata ? { metadata } : {}),
    retrieveTss: (tssId: string) => call<FiskalyTss>('GET', `/tss/${id(tssId)}`),
    // Personalising a TSS (to UNINITIALIZED) can take tens of seconds; fiskaly asks for a 30s timeout or more.
    setTssState: (tssId: string, state: 'UNINITIALIZED' | 'INITIALIZED' | 'DISABLED') => call<FiskalyTss>('PATCH', `/tss/${id(tssId)}`, { state }, state === 'UNINITIALIZED' ? Math.max(timeoutMs, 60_000) : undefined),
    changeAdminPin: (tssId: string, adminPuk: string, newAdminPin: string) => call('PATCH', `/tss/${id(tssId)}/admin`, { admin_puk: adminPuk, new_admin_pin: newAdminPin }),
    authenticateAdmin: (tssId: string, adminPin: string) => call('POST', `/tss/${id(tssId)}/admin/auth`, { admin_pin: adminPin }),
    logoutAdmin: (tssId: string) => call('POST', `/tss/${id(tssId)}/admin/logout`, {}),
    upsertClient: (tssId: string, clientId: string, serialNumber: string) => call<FiskalyClient>('PUT', `/tss/${id(tssId)}/client/${id(clientId)}`, { serial_number: serialNumber }),
    retrieveClient: (tssId: string, clientId: string) => call<FiskalyClient>('GET', `/tss/${id(tssId)}/client/${id(clientId)}`),
    startTransaction: (tssId: string, txId: string, clientId: string) =>
      call<FiskalyTransaction>('PUT', `/tss/${id(tssId)}/tx/${id(txId)}?tx_revision=1`, { state: 'ACTIVE', client_id: clientId }),
    finishTransaction: (tssId: string, txId: string, clientId: string, receipt: FiskalyReceipt, revision = 2) =>
      call<FiskalyTransaction>('PUT', `/tss/${id(tssId)}/tx/${id(txId)}?tx_revision=${revision}`, { state: 'FINISHED', client_id: clientId, schema: { standard_v1: { receipt } } }),
    cancelTransaction: (tssId: string, txId: string, clientId: string, revision = 2) =>
      call<FiskalyTransaction>('PUT', `/tss/${id(tssId)}/tx/${id(txId)}?tx_revision=${revision}`, { state: 'CANCELLED', client_id: clientId }),
    retrieveTransaction: (tssId: string, txId: string) => call<FiskalyTransaction>('GET', `/tss/${id(tssId)}/tx/${id(txId)}`),
  }
}

export type FiskalySignDe = ReturnType<typeof fiskalySignDe>

export interface ProvisionInput {
  tssId: string
  clientId: string
  /** The till's serial number, as the client is registered (and as DSFinV-K's KASSE_SERIENNR). */
  clientSerialNumber: string
  /** The PIN to set (at least 6 characters); keep it, encrypted. */
  adminPin: string
  /** The admin PUK, when a previous attempt created the TSS and kept it. */
  adminPuk?: string | null
  metadata?: Record<string, string>
}

export interface ProvisionResult {
  tss: FiskalyTss
  client: FiskalyClient
  /** The PUK fiskaly answered when this call created the TSS, so the caller can keep it. */
  adminPuk: string | null
}

/**
 * Takes a TSS from nothing (or from wherever an earlier attempt stopped) to
 * INITIALIZED with this till registered as its client. Each step is safe to
 * repeat, so a failed setup is finished by calling this again with the same
 * ids, PIN and the PUK kept from the first answer.
 */
export async function provisionTss(api: FiskalySignDe, input: ProvisionInput): Promise<ProvisionResult> {
  let tss: FiskalyTss | null = null
  let adminPuk = input.adminPuk ?? null
  try {
    tss = await api.retrieveTss(input.tssId)
  }
  catch (error) {
    if (!(error instanceof FiskalyError) || error.failure !== 'not_found') throw error
  }
  if (!tss) {
    tss = await api.createTss(input.tssId, input.metadata)
    if (tss.admin_puk) adminPuk = tss.admin_puk
  }
  if (tss.state === 'DISABLED' || tss.state === 'DEFECTIVE' || tss.state === 'DELETED' || tss.state === 'EVICTED')
    throw new FiskalyError(`The TSE is ${tss.state.toLowerCase()} and cannot sign`, 'invalid', 409, 'E_TSS_STATE')
  if (tss.state === 'CREATED') {
    tss = await api.setTssState(input.tssId, 'UNINITIALIZED')
    if (!adminPuk) throw new FiskalyError('The admin PUK of this TSE was not kept, so its PIN cannot be set', 'invalid', 409, 'E_ADMIN_PUK_MISSING')
    await api.changeAdminPin(input.tssId, adminPuk, input.adminPin)
  }
  await api.authenticateAdmin(input.tssId, input.adminPin)
  try {
    if (tss.state === 'UNINITIALIZED') tss = await api.setTssState(input.tssId, 'INITIALIZED')
    const client = await api.upsertClient(input.tssId, input.clientId, input.clientSerialNumber)
    tss = await api.retrieveTss(input.tssId)
    return { tss, client, adminPuk }
  }
  finally {
    await api.logoutAdmin(input.tssId).catch(() => {})
  }
}

/** A random admin PIN of digits (fiskaly asks for at least 6 characters). */
export function newAdminPin(length = 10): string {
  if (!Number.isSafeInteger(length) || length < 6) throw new Error('An admin PIN needs at least 6 characters')
  let pin = ''
  while (pin.length < length) {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    // 250 is the largest multiple of 10 below 256: higher bytes would favour 0 to 5.
    for (const byte of bytes) if (byte < 250 && pin.length < length) pin += String(byte % 10)
  }
  return pin
}

/**
 * A client serial number fiskaly accepts (and DSFinV-K's KASSE_SERIENNR):
 * letters, digits, spaces and ' ( ) + , - . : = ?, at most 70, no "_" or "/".
 */
export function isClientSerialNumber(value: string): boolean {
  return /^(?!\s)[A-Za-z0-9 '()+,\-.:=?]{1,70}(?<!\s)$/.test(value)
}
