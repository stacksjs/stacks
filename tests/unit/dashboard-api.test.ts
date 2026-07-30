import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { useAuth } from '../../storage/framework/defaults/functions/auth'
import { dashboardApi } from '../../storage/framework/defaults/functions/dashboard-api'

const originalFetch = globalThis.fetch
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame')

beforeEach(() => {
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      callback(performance.now())
      return 1
    },
  })
  useAuth().token.value = ''
  useAuth().user.value = null
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { cookie: 'X-CSRF-Token=test-csrf-token' },
  })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalDocument)
    Object.defineProperty(globalThis, 'document', originalDocument)
  else
    Reflect.deleteProperty(globalThis, 'document')
  if (originalRequestAnimationFrame)
    Object.defineProperty(globalThis, 'requestAnimationFrame', originalRequestAnimationFrame)
  else
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
})

describe('dashboard API authentication', () => {
  it('submits registration to the framework auth route with CSRF credentials', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return Response.json({
        token: 'issued-token',
        user: { id: 1, name: 'Test Operator', email: 'operator@example.test' },
      })
    })
    globalThis.fetch = fetchMock as typeof fetch

    const result = await useAuth().register({
      name: 'Test Operator',
      email: 'operator@example.test',
      password: 'secure-password',
      password_confirmation: 'secure-password',
    })

    expect('token' in result).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [path, options] = fetchMock.mock.calls[0]
    expect(path).toBe('/register')
    expect(options?.credentials).toBe('same-origin')
    expect(options?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'test-csrf-token',
    })
  })

  it('sends bearer and CSRF credentials through the shared dashboard client', async () => {
    useAuth().token.value = 'operator-token'
    const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return Response.json({ ok: true })
    })
    globalThis.fetch = fetchMock as typeof fetch

    await dashboardApi('/api/dashboard/test', {
      method: 'POST',
      body: { enabled: true },
    })

    const [path, options] = fetchMock.mock.calls[0]
    expect(path).toBe('/api/dashboard/test')
    expect(options?.credentials).toBe('same-origin')
    expect(options?.headers).toMatchObject({
      Authorization: 'Bearer operator-token',
      'X-CSRF-Token': 'test-csrf-token',
      'content-type': 'application/json',
    })
  })

  it('sends multipart forms without replacing the browser boundary header', async () => {
    const formData = new FormData()
    formData.append('path', 'images')
    formData.append('files', new File(['image'], 'photo.jpg', { type: 'image/jpeg' }))
    const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ uploaded: [] }))
    globalThis.fetch = fetchMock as typeof fetch

    await dashboardApi('/api/dashboard/files/uploads', {
      method: 'POST',
      formData,
    })

    const [, options] = fetchMock.mock.calls[0]
    expect(options?.body).toBe(formData)
    expect(options?.headers).toMatchObject({
      'X-CSRF-Token': 'test-csrf-token',
    })
    expect((options?.headers as Record<string, string>)['content-type']).toBeUndefined()
  })

  it('keeps failed logins unauthenticated and returns the server message', async () => {
    const fetchMock = mock(async () => {
      return Response.json({ message: 'Invalid credentials' }, { status: 422 })
    })
    globalThis.fetch = fetchMock as typeof fetch

    const result = await useAuth().login({
      email: 'operator@example.test',
      password: 'incorrect-password',
    })

    expect(result).toEqual({ message: 'Invalid credentials' })
    expect(useAuth().getToken()).toBe('')
    const [path, options] = fetchMock.mock.calls[0]
    expect(path).toBe('/login')
    expect(options?.credentials).toBe('same-origin')
    expect(options?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'test-csrf-token',
    })
  })
})
