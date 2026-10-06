import type { TerminalAuthorizer, TerminalEvent } from './remote-terminal'
import { Gate } from '@stacksjs/auth'
import { TerminalSessions } from './remote-terminal'
import { createPtySpawner, loggingTerminalAuditSink } from './ssh-runner'

/**
 * The server's terminal sessions (stacksjs/stacks#960), and how they reach the
 * browser.
 *
 * Sessions live in this process. Production runs one server process, so the
 * stream and the input for a session land on the same one; during the
 * overlap of a zero-downtime deploy a request can reach the other release,
 * which answers 404 and the dashboard reports the session as ended - closed,
 * not crossed.
 */
export const terminalSessions: TerminalSessions = new TerminalSessions({
  spawn: createPtySpawner(),
  audit: loggingTerminalAuditSink,
})

/**
 * The `open-remote-terminal` gate, or undefined when the app has not defined
 * it - and `TerminalSessions.open` refuses in that case rather than proceeding.
 */
export function terminalAuthorizer(): TerminalAuthorizer | undefined {
  return Gate.has('open-remote-terminal')
    ? (user, hostKey) => Gate.allows('open-remote-terminal', user, hostKey)
    : undefined
}

/** How often a quiet stream says it is still there, inside every proxy's idle limit. */
export const HEARTBEAT_MS = 15_000

/**
 * One terminal event as server-sent events. Output is base64, because PTY
 * output is bytes - a multi-byte character can be split across two chunks,
 * and decoding each chunk as text on its own would corrupt it. The `id` is the
 * sequence number a reconnecting viewer sends back.
 */
export function encodeTerminalEvent(event: TerminalEvent): string {
  if (event.type === 'output')
    return `id: ${event.seq}\nevent: output\ndata: ${Buffer.from(event.data).toString('base64')}\n\n`
  return `event: exit\ndata: ${JSON.stringify({ reason: event.reason, exitCode: event.exitCode })}\n\n`
}

/**
 * A session's events as an SSE body, with a comment line every
 * {@link HEARTBEAT_MS} so neither Bun's idle timeout nor a proxy closes a
 * terminal nobody is typing in. Cancelling the body - the tab closing - stops
 * watching, which starts the session's detach grace.
 */
export function terminalEventStream(events: AsyncIterable<TerminalEvent>, heartbeatMs = HEARTBEAT_MS): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const iterator = events[Symbol.asyncIterator]()
  let heartbeat: ReturnType<typeof setInterval> | undefined

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'))
      heartbeat = setInterval(() => controller.enqueue(encoder.encode(': ping\n\n')), heartbeatMs)
    },
    async pull(controller) {
      const { value, done } = await iterator.next()
      if (done) {
        clearInterval(heartbeat)
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(encodeTerminalEvent(value)))
      if (value.type === 'exit') {
        clearInterval(heartbeat)
        controller.close()
      }
    },
    async cancel() {
      clearInterval(heartbeat)
      await iterator.return?.()
    },
  })
}
