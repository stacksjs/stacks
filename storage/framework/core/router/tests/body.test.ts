import { expect, test } from 'bun:test'
import { readJsonBody, readTextBody } from '../src/body'

const request = (body: BodyInit, headers: Record<string, string> = {}) => new Request('https://example.com', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body })
test('bounded JSON handles UTF-8 and refuses malformed input and media types', async () => {
  expect(await readJsonBody(request('{"name":"é"}'))).toEqual({ name: 'é' })
  await expect(readJsonBody(request('{'))).rejects.toMatchObject({ status: 400 })
  await expect(readJsonBody(request('{}', { 'Content-Type': 'text/plain' }))).rejects.toMatchObject({ status: 415 })
  await expect(readJsonBody(request('{}', { 'Content-Length': '900' }), 20)).rejects.toMatchObject({ status: 413 })
  await expect(readJsonBody(request(new Uint8Array([0xff])))).rejects.toMatchObject({ status: 400 })
})
test('counts streamed bytes when Content-Length is missing or dishonest', async () => {
  let cancelled = false
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(8)) },
    cancel() { cancelled = true },
  })
  await expect(readJsonBody(request(body, { 'Content-Length': '1' }), 10)).rejects.toMatchObject({ status: 413 })
  expect(cancelled).toBe(true)
})

test('bounded form reads count bytes without trusting Content-Length', async () => {
  expect(await readTextBody(request('grant_type=refresh_token', { 'Content-Type': 'application/x-www-form-urlencoded' }), 100)).toBe('grant_type=refresh_token')
  await expect(readTextBody(request('é'.repeat(10), { 'Content-Length': '1' }), 10)).rejects.toMatchObject({ status: 413 })
})
