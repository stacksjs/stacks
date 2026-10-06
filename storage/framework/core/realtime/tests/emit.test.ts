import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { emit } from '../src/emit'
import { createServer, stopServer } from '../src/server-instance'
import { randomPort, settle, subscriber } from './fixtures/realtime'

/**
 * `emit(..., { exclude })` leaves out sockets by socket ID - every one of
 * them. An array used to be cut to its first entry, so all but one of the
 * sockets a caller excluded still received the event.
 */

const port = randomPort()

beforeAll(async () => {
  await createServer({ host: '127.0.0.1', port })
})

afterAll(async () => {
  await stopServer()
})

describe('emit() exclude', () => {
  test('leaves out every socket ID in an array', async () => {
    const [a, b, c] = await Promise.all([subscriber(port, 'room'), subscriber(port, 'room'), subscriber(port, 'room')])

    emit('room', 'typing', { who: 'a' }, { exclude: [a.socketId, b.socketId] })
    await settle(150)

    expect(a.inbox).toEqual([])
    expect(b.inbox).toEqual([])
    expect(c.inbox).toEqual([{ event: 'typing', channel: 'room', data: { who: 'a' } }])

    for (const sub of [a, b, c])
      sub.socket.close()
  })

  test('leaves out a single socket ID', async () => {
    const [a, b] = await Promise.all([subscriber(port, 'lobby'), subscriber(port, 'lobby')])

    emit('lobby', 'joined', {}, { exclude: a.socketId })
    await settle(150)

    expect(a.inbox).toEqual([])
    expect(b.inbox.map(m => m.event)).toEqual(['joined'])

    for (const sub of [a, b])
      sub.socket.close()
  })
})
