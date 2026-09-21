/**
 * A PostgreSQL server that puts a real Bun SQL pool into the oven-sh/bun#42804
 * state on every connection, for the broken-pool tests.
 *
 * It completes the login and, in the same write, sends ReadyForQuery followed
 * by a FATAL 57P01 ("terminating connection due to administrator command"),
 * then closes the socket. That is the trigger robobun isolated on #42804. With
 * Bun 1.4.1 on macOS, in 15 of 15 runs each: a pool of 10 rejected all three
 * of its queries with "connection must be a PostgresSQLConnection", and a pool
 * of 1 rejected its first with "Failed to read data"
 * (ERR_POSTGRES_EXPECTED_REQUEST) and the next two with that message. Either
 * pool's close() was still pending 2 seconds later. `authFailure` answers
 * every login with a FATAL 28P01 instead, an ordinary error that must not be
 * taken for a broken pool.
 *
 * The tests built on it depend on Bun still breaking the pool, which is the
 * point: when a Bun upgrade stops that, they fail with
 * {@link BUN_42804_NO_LONGER_REPRODUCES} rather than pass silently.
 *
 * Listens on 127.0.0.1 with an OS-assigned port. Every connection gets the same
 * reply to its startup message, and no query is ever answered.
 */

/** What the tests built on this server say when Bun no longer breaks the pool. */
export const BUN_42804_NO_LONGER_REPRODUCES = 'This Bun no longer leaves the pool broken the way oven-sh/bun#42804 describes. '
  + 'Re-check oven-sh/bun#42804 and its fix oven-sh/bun#40913. If this Bun carries the fix, remove the detector: '
  + 'core/database/src/broken-pool.ts, everything that feeds or reads it, and the tests and fixtures built on this server.'

function message(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + body.length)
  out[0] = type.charCodeAt(0)
  new DataView(out.buffer).setInt32(1, 4 + body.length)
  out.set(body, 5)
  return out
}

function int32(value: number): Uint8Array {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setInt32(0, value)
  return out
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((length, part) => length + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const cstring = (value: string): Uint8Array => new TextEncoder().encode(`${value}\0`)

function fatal(code: string, text: string): Uint8Array {
  return message('E', concat(cstring('SFATAL'), cstring('VFATAL'), cstring(`C${code}`), cstring(`M${text}`), new Uint8Array([0])))
}

const LOGIN_THEN_TERMINATED = concat(
  message('R', int32(0)),
  message('S', concat(cstring('server_version'), cstring('16.0'))),
  message('K', concat(int32(4242), int32(4242))),
  message('Z', new TextEncoder().encode('I')),
  fatal('57P01', 'terminating connection due to administrator command'),
)

const AUTH_FAILED = fatal('28P01', 'password authentication failed for user "stacks"')

/** The 8-byte SSLRequest a client may send before its startup message. */
const SSL_REQUEST_CODE = 80877103

export interface Bun42804Server {
  port: number
  /** TCP connections accepted so far. */
  connections: () => number
  stop: () => void
}

export function startBun42804Server(options: { authFailure?: boolean } = {}): Bun42804Server {
  let connections = 0
  const reply = options.authFailure ? AUTH_FAILED : LOGIN_THEN_TERMINATED
  const server = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      open() {
        connections++
      },
      data(socket, data) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
        if (data.byteLength === 8 && view.getInt32(4) === SSL_REQUEST_CODE) {
          socket.write('N')
          return
        }
        socket.write(reply)
        socket.end()
      },
    },
  })

  return {
    port: server.port,
    connections: () => connections,
    stop: () => server.stop(true),
  }
}
