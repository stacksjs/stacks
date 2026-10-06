import { describe, expect, test } from 'bun:test'
import { encodeTerminalEvent } from '../app/Actions/Dashboard/Remote/terminal-sessions'
import { parseTerminalEvents } from './remote'

/**
 * The dashboard reads a terminal's server-sent events through `fetch`, because
 * `EventSource` cannot send its bearer token, so it parses the stream itself.
 * Encoded by the server's own encoder, split anywhere the network might.
 */
function streamOf(text: string, chunkSize: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  let offset = 0
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length)
        return controller.close()
      controller.enqueue(bytes.slice(offset, offset + chunkSize))
      offset += chunkSize
    },
  })
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const events = []
  for await (const event of parseTerminalEvents(stream))
    events.push(event)
  return events
}

describe('parseTerminalEvents', () => {
  // "é" is two bytes, delivered in two output events, as a PTY can.
  const wire = [
    ': connected\n\n',
    encodeTerminalEvent({ type: 'output', seq: 1, data: new Uint8Array([0x68, 0x69, 0x20, 0xC3]) }),
    ': ping\n\n',
    encodeTerminalEvent({ type: 'output', seq: 2, data: new Uint8Array([0xA9]) }),
    encodeTerminalEvent({ type: 'exit', reason: 'exited', exitCode: 3 }),
  ].join('')

  test('reads output, skips heartbeats, and ends on exit, however the bytes are split', async () => {
    for (const chunkSize of [1, 3, 7, 64, wire.length]) {
      const events = await collect(streamOf(wire, chunkSize))
      expect(events.map(event => event.type)).toEqual(['output', 'output', 'exit'])
      expect(events[2]).toEqual({ type: 'exit', reason: 'exited', exitCode: 3 })

      const [first, second] = events as Array<{ seq: number, data: Uint8Array }>
      expect([first!.seq, second!.seq]).toEqual([1, 2])
      const joined = new Uint8Array([...first!.data, ...second!.data])
      expect(new TextDecoder().decode(joined)).toBe('hi é')
    }
  })
})
