import { describe, expect, it } from 'bun:test'
import { FiskalyError, fiskalySignDe, isClientSerialNumber, newAdminPin, provisionTss } from '../fiskaly'

interface Call { method: string, path: string, body: any, auth: string | null }

/**
 * Just enough of fiskaly SIGN DE v2 to drive the client: tokens, the TSS
 * states and their order, admin sign-in, clients and transactions, with
 * fiskaly's error shape. (HQ's end-to-end tests run a fuller HTTP fake.)
 */
function fakeFiskaly(options: { tokenSeconds?: number, failAuth?: boolean } = {}) {
  const calls: Call[] = []
  const tss = new Map<string, any>()
  let tokens = 0
  let admin = false
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const error = (status: number, code: string, message: string) => json({ status_code: status, error: 'Error', code, message }, status)
  const fetch = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(input)
    const path = url.pathname.replace('/api/v2', '')
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    const auth = (init.headers as Record<string, string>)?.Authorization ?? null
    calls.push({ method: String(init.method), path: `${path}${url.search}`, body, auth })
    if (path === '/auth') {
      if (options.failAuth || (body.api_key && body.api_key !== 'key')) return error(401, 'E_UNAUTHORIZED', 'Invalid credentials')
      tokens++
      return json({ access_token: `token-${tokens}`, access_token_expires_in: options.tokenSeconds ?? 86400, refresh_token: `refresh-${tokens}`, access_token_claims: { env: 'TEST', organization_id: 'org-1' } })
    }
    if (!auth?.startsWith('Bearer token-')) return error(401, 'E_UNAUTHORIZED', 'No token')
    const match = path.match(/^\/tss\/([^/]+)(\/.*)?$/)
    const id = match?.[1] ?? ''
    const rest = match?.[2] ?? ''
    const row = tss.get(id)
    if (rest === '' && init.method === 'GET') return row ? json(row) : error(404, 'E_TSS_NOT_FOUND', 'No such TSS')
    if (rest === '' && init.method === 'PUT') {
      if (row && row.state !== 'CREATED') return error(409, 'E_TSS_CONFLICT', 'Exists')
      const created = row ?? { _id: id, state: 'CREATED', admin_puk: 'PUK1234567', serial_number: 'ab'.repeat(32), public_key: 'cHVi', signature_algorithm: 'ecdsa-plain-SHA256', signature_timestamp_format: 'unixTime' }
      tss.set(id, created)
      return json(created)
    }
    if (rest === '' && init.method === 'PATCH') {
      const allowed: Record<string, string> = { UNINITIALIZED: 'CREATED', INITIALIZED: 'UNINITIALIZED' }
      if (row.state !== allowed[body.state]) return error(400, 'E_ILLEGAL_TSS_STATE_CHANGE', `${row.state} to ${body.state}`)
      if (body.state === 'INITIALIZED' && !admin) return error(401, 'E_UNAUTHORIZED', 'Admin not signed in')
      const { admin_puk, ...next } = { ...row, state: body.state }
      void admin_puk
      tss.set(id, next)
      return json(next)
    }
    if (rest === '/admin') return body.admin_puk === 'PUK1234567' && body.new_admin_pin.length >= 6 ? json({}) : error(400, 'E_CHANGE_ADMIN_PIN_FAILED', 'Wrong PUK')
    if (rest === '/admin/auth') {
      admin = body.admin_pin === row.pin || body.admin_pin.length >= 6
      return json({})
    }
    if (rest === '/admin/logout') {
      admin = false
      return json({})
    }
    if (rest.startsWith('/client/')) {
      if (!admin) return error(401, 'E_UNAUTHORIZED', 'Admin not signed in')
      return json({ _id: rest.slice(8), serial_number: body.serial_number, state: 'REGISTERED', tss_id: id })
    }
    if (rest.startsWith('/tx/')) {
      if (row?.state !== 'INITIALIZED') return error(400, 'E_TSS_NOT_INITIALIZED', 'Not initialized')
      const revision = Number(url.searchParams.get('tx_revision'))
      return json({ _id: rest.slice(4), state: body.state, number: 1, revision, latest_revision: revision, client_id: body.client_id, time_start: 1760338800, time_end: body.state === 'FINISHED' ? 1760338801 : undefined, signature: { value: 'c2ln', algorithm: 'ecdsa-plain-SHA256', counter: '7', public_key: 'cHVi' }, qr_code_data: 'V0;...' })
    }
    return error(404, 'E_NOT_FOUND', path)
  }) as unknown as typeof fetch
  return { fetch, calls, tss }
}

describe('fiskaly SIGN DE client', () => {
  it('signs in once and reuses the token', async () => {
    const fake = fakeFiskaly()
    const api = fiskalySignDe({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://fiskaly.test/api/v2', fetch: fake.fetch })
    expect(await api.authenticate()).toEqual({ organizationId: 'org-1', environment: 'TEST' })
    await api.createTss('tss-1')
    await api.retrieveTss('tss-1')
    expect(fake.calls.filter(call => call.path === '/auth')).toHaveLength(1)
    expect(fake.calls.at(-1)?.auth).toBe('Bearer token-1')
  })

  it('refreshes a token about to run out', async () => {
    const fake = fakeFiskaly({ tokenSeconds: 30 })
    const api = fiskalySignDe({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://fiskaly.test/api/v2', fetch: fake.fetch })
    await api.createTss('tss-1')
    await api.retrieveTss('tss-1')
    const auths = fake.calls.filter(call => call.path === '/auth')
    expect(auths).toHaveLength(2)
    expect(auths[1]!.body).toEqual({ refresh_token: 'refresh-1' })
  })

  it('turns fiskaly’s errors into FiskalyError, and knows an outage', async () => {
    const api = fiskalySignDe({ apiKey: 'wrong', apiSecret: 'secret', baseUrl: 'https://fiskaly.test/api/v2', fetch: fakeFiskaly().fetch })
    const rejected = await api.authenticate().catch(error => error)
    expect(rejected).toBeInstanceOf(FiskalyError)
    expect(rejected).toMatchObject({ failure: 'rejected', status: 401, code: 'E_UNAUTHORIZED', message: 'Invalid credentials' })
    expect(rejected.outage).toBe(false)
    const down = fiskalySignDe({ apiKey: 'key', apiSecret: 'secret', fetch: (async () => { throw new TypeError('fetch failed') }) as any })
    const unreachable = await down.retrieveTss('x').catch(error => error)
    expect(unreachable).toMatchObject({ failure: 'unreachable', status: 0 })
    expect(unreachable.outage).toBe(true)
    expect(new FiskalyError('busy', 'failed', 503).outage).toBe(true)
  })

  it('provisions a TSS from nothing: create, personalise, PIN, admin, initialise, client, logout', async () => {
    const fake = fakeFiskaly()
    const api = fiskalySignDe({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://fiskaly.test/api/v2', fetch: fake.fetch })
    const result = await provisionTss(api, { tssId: 'tss-1', clientId: 'client-1', clientSerialNumber: 'HQ-1-2', adminPin: '1234567890' })
    expect(result.tss.state).toBe('INITIALIZED')
    expect(result.client).toMatchObject({ serial_number: 'HQ-1-2', state: 'REGISTERED' })
    expect(result.adminPuk).toBe('PUK1234567')
    expect(fake.calls.filter(call => call.path !== '/auth').map(call => `${call.method} ${call.path}${call.body?.state ? ` ${call.body.state}` : ''}`)).toEqual([
      'GET /tss/tss-1',
      'PUT /tss/tss-1',
      'PATCH /tss/tss-1 UNINITIALIZED',
      'PATCH /tss/tss-1/admin',
      'POST /tss/tss-1/admin/auth',
      'PATCH /tss/tss-1 INITIALIZED',
      'PUT /tss/tss-1/client/client-1',
      'GET /tss/tss-1',
      'POST /tss/tss-1/admin/logout',
    ])
  })

  it('finishes a setup that stopped halfway, with the PUK kept from the first answer', async () => {
    const fake = fakeFiskaly()
    const api = fiskalySignDe({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://fiskaly.test/api/v2', fetch: fake.fetch })
    await api.createTss('tss-2')
    await api.setTssState('tss-2', 'UNINITIALIZED')
    await api.changeAdminPin('tss-2', 'PUK1234567', '1234567890')
    const result = await provisionTss(api, { tssId: 'tss-2', clientId: 'client-2', clientSerialNumber: 'HQ-2', adminPin: '1234567890', adminPuk: 'PUK1234567' })
    expect(result.tss.state).toBe('INITIALIZED')
    expect(fake.calls.filter(call => call.path === '/tss/tss-2/admin' && call.method === 'PATCH')).toHaveLength(1)
  })

  it('starts and finishes a transaction with the receipt schema and revisions 1 and 2', async () => {
    const fake = fakeFiskaly()
    const api = fiskalySignDe({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://fiskaly.test/api/v2', fetch: fake.fetch })
    await provisionTss(api, { tssId: 'tss-3', clientId: 'client-3', clientSerialNumber: 'HQ-3', adminPin: '1234567890' })
    await api.startTransaction('tss-3', 'tx-1', 'client-3')
    const finished = await api.finishTransaction('tss-3', 'tx-1', 'client-3', { receipt_type: 'RECEIPT', amounts_per_vat_rate: [{ vat_rate: 'NORMAL', amount: '2.00' }], amounts_per_payment_type: [{ payment_type: 'CASH', amount: '2.00' }] })
    expect(finished).toMatchObject({ state: 'FINISHED', revision: 2 })
    expect(Number(finished.signature?.counter)).toBe(7)
    const [start, finish] = fake.calls.filter(call => call.path.startsWith('/tss/tss-3/tx/'))
    expect(start).toMatchObject({ method: 'PUT', path: '/tss/tss-3/tx/tx-1?tx_revision=1', body: { state: 'ACTIVE', client_id: 'client-3' } })
    expect(finish!.path).toBe('/tss/tss-3/tx/tx-1?tx_revision=2')
    expect(finish!.body.schema.standard_v1.receipt.amounts_per_vat_rate).toEqual([{ vat_rate: 'NORMAL', amount: '2.00' }])
  })
})

describe('admin PINs and client serial numbers', () => {
  it('makes PINs of digits of the length asked for', () => {
    for (let i = 0; i < 50; i++) expect(newAdminPin()).toMatch(/^\d{10}$/)
    expect(newAdminPin(6)).toMatch(/^\d{6}$/)
    expect(() => newAdminPin(4)).toThrow()
  })

  it('accepts the serials fiskaly and DSFinV-K accept', () => {
    expect(isClientSerialNumber('HQ-12-3 a1b2')).toBe(true)
    expect(isClientSerialNumber('HQ_12')).toBe(false)
    expect(isClientSerialNumber('HQ/12')).toBe(false)
    expect(isClientSerialNumber(' HQ')).toBe(false)
    expect(isClientSerialNumber('x'.repeat(71))).toBe(false)
  })
})
