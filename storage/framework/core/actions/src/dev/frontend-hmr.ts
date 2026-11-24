import { dirname } from 'node:path'

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
  let opening: string | undefined = ''
  const body = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TransformStream<string, string>({
      transform(chunk, controller) {
        if (opening === undefined) {
          controller.enqueue(chunk)
          return
        }
        opening += chunk
        const boundary = opening.indexOf('\n\n')
        if (boundary === -1)
          return
        const first = opening.slice(0, boundary)
        const event = handoff ? first.replace(/("type"\s*:\s*)"connected"/, '$1"fragment"') : first
        // Set the ID on the opening event only. Later STX events retain it.
        controller.enqueue(`retry: 250\nid: ${id}\n${event}${opening.slice(boundary)}`)
        opening = undefined
      },
      flush(controller) {
        if (opening)
          controller.enqueue(opening)
      },
    }))
    .pipeThrough(new TextEncoderStream())
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(body, { headers, status: response.status, statusText: response.statusText })
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

