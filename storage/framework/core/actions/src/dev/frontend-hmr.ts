import { dirname } from 'node:path'

export const devRuntimeSource = /\.(?:[cm]?[jt]s|[jt]sx|json)$/i

/**
 * Attach the serving worker's identity to STX's event stream. EventSource
 * sends the last ID when it reconnects. A new worker can then ask the loaded
 * STX client for the same fragment refresh it uses for a template edit.
 */
export function frontendHmrResponse(request: Request, response: Response, worker: string): Response | undefined {
  if (!response.body || !response.headers.get('content-type')?.startsWith('text/event-stream')
    || new URL(request.url).pathname !== '/_stx/hmr')
    return

  const id = `stacks-worker:${worker}`
  const previous = request.headers.get('last-event-id')
  const handoff = previous?.startsWith('stacks-worker:') && previous !== id
  let pending = ''
  let opening = true
  const body = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TransformStream<string, string>({
      transform(chunk, controller) {
        pending += chunk
        let boundary: number
        while ((boundary = pending.indexOf('\n\n')) !== -1) {
          const event = refreshEvent(pending.slice(0, boundary), opening && Boolean(handoff))
          // Set the ID on the opening event only. Later STX events retain it.
          controller.enqueue((opening ? `retry: 250\nid: ${id}\n` : '') + event + '\n\n')
          opening = false
          pending = pending.slice(boundary + 2)
        }
      },
      flush(controller) {
        if (pending)
          controller.enqueue(pending)
      },
    }))
    .pipeThrough(new TextEncoderStream())
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(body, { headers, status: response.status, statusText: response.statusText })
}

function refreshEvent(frame: string, handoff: boolean): string {
  if (!frame.startsWith('data:'))
    return frame
  try {
    const event = JSON.parse(frame.slice('data:'.length))
    // STX can see a code edit in the views tree before Buddy finishes the
    // handoff. That notification should use the in-place refresh as well.
    if ((handoff && event.type === 'connected')
      || (event.type === 'reload' && typeof event.file === 'string' && devRuntimeSource.test(event.file)))
      return 'data: ' + JSON.stringify({ ...event, type: 'fragment' })
  }
  catch { /* Keep protocol messages we do not recognize. */ }
  return frame
}

/** Keep the fragment ABI stable across process swaps with the same STX runtime. */
export function frontendBuildId(entry: string, session: string): string {
  let from = dirname(entry)
  const runtime: string[] = []
  for (const name of ['bun-plugin-stx/serve', '@stacksjs/stx', 'stx-router']) {
    try {
      const path = Bun.resolveSync(name, from)
      const file = Bun.file(path)
      runtime.push(`${path}:${file.size}:${file.lastModified}`)
      from = dirname(path)
    }
    catch { /* Custom frontend entries may use another runtime. */ }
  }
  return `${session}-${Bun.hash(runtime.join('\n')).toString(36)}`
}

