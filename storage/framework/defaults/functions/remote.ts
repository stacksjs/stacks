import { dashboardApi, dashboardStream } from './dashboard-api'

/**
 * The dashboard's remote hosts: named commands, and interactive terminals on
 * the hosts that allow them (stacksjs/stacks#960).
 */

export interface RemoteHostSummary {
  key: string
  host: string
  user: string
  port: number
  terminal: boolean
}

export interface RemoteCommandSummary {
  key: string
  description: string
  argv: string[]
  hosts: string[] | null
}

export interface RemoteRegistry {
  hosts: RemoteHostSummary[]
  commands: RemoteCommandSummary[]
}

export interface RemoteCommandResult {
  host: string
  command: string
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  timedOut: boolean
}

export type TerminalStreamEvent =
  | { type: 'output', seq: number, data: Uint8Array }
  | { type: 'exit', reason: string, exitCode: number | null }

export function fetchRemoteRegistry(): Promise<RemoteRegistry> {
  return dashboardApi<RemoteRegistry>('/api/dashboard/remote/commands')
}

export function requestRemoteCommand(host: string, command: string): Promise<RemoteCommandResult> {
  return dashboardApi<RemoteCommandResult>('/api/dashboard/remote/run', { method: 'POST', body: { host, command } })
}

export function openTerminalSession(host: string, cols: number, rows: number): Promise<{ id: string, host: string }> {
  return dashboardApi('/api/dashboard/remote/terminals', { method: 'POST', body: { host, cols, rows } })
}

export function sendTerminalInput(id: string, data: string): Promise<unknown> {
  return dashboardApi(`/api/dashboard/remote/terminals/${encodeURIComponent(id)}/input`, { method: 'POST', body: { data } })
}

export function resizeTerminalSession(id: string, cols: number, rows: number): Promise<unknown> {
  return dashboardApi(`/api/dashboard/remote/terminals/${encodeURIComponent(id)}/resize`, { method: 'POST', body: { cols, rows } })
}

export function closeTerminalSession(id: string): Promise<unknown> {
  return dashboardApi(`/api/dashboard/remote/terminals/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/**
 * A session's events, from after sequence `after`, until the session ends or
 * `signal` aborts. Ends without an exit event when the connection drops, so
 * the caller can reconnect from the last sequence it saw.
 */
export async function* streamTerminal(id: string, after: number, signal: AbortSignal): AsyncGenerator<TerminalStreamEvent> {
  const res = await dashboardStream(`/api/dashboard/remote/terminals/${encodeURIComponent(id)}/stream?after=${after}`, { signal })
  if (!res.body)
    return
  yield* parseTerminalEvents(res.body)
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Server-sent events from a byte stream, however the network splits them.
 * Comments (the heartbeat) and unknown events are skipped.
 */
export async function* parseTerminalEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<TerminalStreamEvent> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done)
        return
      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')

        let event = 'message'
        let id = ''
        const data: string[] = []
        for (const line of block.split('\n')) {
          if (line.startsWith(':'))
            continue
          const colon = line.indexOf(':')
          const field = colon === -1 ? line : line.slice(0, colon)
          const raw = colon === -1 ? '' : line.slice(colon + 1)
          const content = raw.startsWith(' ') ? raw.slice(1) : raw
          if (field === 'event')
            event = content
          else if (field === 'id')
            id = content
          else if (field === 'data')
            data.push(content)
        }

        if (event === 'output')
          yield { type: 'output', seq: Number(id), data: decodeBase64(data.join('')) }
        else if (event === 'exit')
          yield { type: 'exit', ...(JSON.parse(data.join('\n')) as { reason: string, exitCode: number | null }) }
      }
    }
  }
  finally {
    reader.releaseLock()
  }
}
