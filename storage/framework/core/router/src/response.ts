/**
 * Response Factory
 *
 * Provides fluent response helpers for Stacks actions.
 * This mirrors the bun-router response factory API.
 */

/**
 * JSON response options
 */
export interface JsonResponseOptions {
  status?: number
  headers?: Record<string, string>
  pretty?: boolean
}

/**
 * Response factory with common response helpers
 */
export const response = {
  /**
   * Create a JSON response
   */
  json: <T>(data: T, options: JsonResponseOptions = {}): Response => {
    const { status = 200, headers = {}, pretty = false } = options
    let body: string
    try {
      body = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)
    }
    catch {
      // Handle circular references or non-serializable data
      body = JSON.stringify({ error: 'Response data could not be serialized' })
    }

    return new Response(body, {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    })
  },

  /**
   * Create a 204 No Content response
   */
  noContent: (headers: Record<string, string> = {}): Response => {
    return new Response(null, {
      status: 204,
      headers,
    })
  },

  /**
   * Create a 201 Created response
   */
  created: <T>(data: T, options: JsonResponseOptions = {}): Response => {
    return response.json(data, { ...options, status: 201 })
  },

  /**
   * Create a 400 Bad Request response
   */
  badRequest: <T>(data: T, options: JsonResponseOptions = {}): Response => {
    return response.json(data, { ...options, status: 400 })
  },

  /**
   * Create a 401 Unauthorized response
   */
  unauthorized: <T>(data: T = { error: 'Unauthorized' } as T, options: JsonResponseOptions = {}): Response => {
    return response.json(data, { ...options, status: 401 })
  },

  /**
   * Create a 403 Forbidden response
   */
  forbidden: <T>(data: T = { error: 'Forbidden' } as T, options: JsonResponseOptions = {}): Response => {
    return response.json(data, { ...options, status: 403 })
  },

  /**
   * Create a 404 Not Found response
   */
  notFound: <T>(data: T = { error: 'Not Found' } as T, options: JsonResponseOptions = {}): Response => {
    return response.json(data, { ...options, status: 404 })
  },

  /**
   * Create a 500 Internal Server Error response
   */
  error: <T>(data: T = { error: 'Internal Server Error' } as T, options: JsonResponseOptions = {}): Response => {
    return response.json(data, { ...options, status: 500 })
  },

  /**
   * Create a redirect response
   */
  redirect: (url: string, status: 301 | 302 | 303 | 307 | 308 = 302): Response => {
    return new Response(null, {
      status,
      headers: { Location: url },
    })
  },

  /**
   * Create a text response
   */
  text: (text: string, options: { status?: number, headers?: Record<string, string> } = {}): Response => {
    const { status = 200, headers = {} } = options
    return new Response(text, {
      status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        ...headers,
      },
    })
  },

  /**
   * Create an HTML response
   */
  html: (html: string, options: { status?: number, headers?: Record<string, string> } = {}): Response => {
    const { status = 200, headers = {} } = options
    return new Response(html, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...headers,
      },
    })
  },

  /**
   * Stream a response body chunk-by-chunk. Use this when the body is
   * large enough that buffering the whole thing in memory before
   * sending would hurt latency (large JSON exports, generated CSV/PDF,
   * SSE feeds). The `producer` callback receives a `controller` it can
   * `enqueue()` chunks against — both `string` and `Uint8Array` are
   * accepted; strings are utf-8 encoded automatically.
   *
   * @example
   * ```ts
   * return response.stream(async (controller) => {
   *   for await (const row of rows) {
   *     controller.enqueue(JSON.stringify(row) + '\n')
   *   }
   *   controller.close()
   * }, { contentType: 'application/x-ndjson' })
   * ```
   */
  stream: (
    producer: (controller: ReadableStreamDefaultController<Uint8Array>) => void | Promise<void>,
    options: { status?: number, headers?: Record<string, string>, contentType?: string } = {},
  ): Response => {
    const { status = 200, headers = {}, contentType = 'application/octet-stream' } = options
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(rawCtrl) {
        // Wrap the underlying controller so producer callers can
        // enqueue plain strings without doing the TextEncoder dance
        // every time — a tiny ergonomics win that keeps stream
        // handlers readable.
        const ctrl = new Proxy(rawCtrl, {
          get(target, prop, receiver) {
            if (prop === 'enqueue') {
              return (chunk: Uint8Array | string) => {
                target.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
              }
            }
            return Reflect.get(target, prop, receiver)
          },
        }) as ReadableStreamDefaultController<Uint8Array>
        try {
          await producer(ctrl)
          // Producer is allowed to call .close() itself; if they didn't,
          // we close on their behalf so the response actually ends.
          try { rawCtrl.close() }
          catch { /* already closed by producer */ }
        }
        catch (err) {
          rawCtrl.error(err)
        }
      },
    })

    return new Response(stream, {
      status,
      headers: {
        'Content-Type': contentType,
        // Disable proxy buffering for clients that respect this hint
        // (Nginx, Cloudflare). Keeps SSE / NDJSON feeds chunked end-to-end.
        'X-Accel-Buffering': 'no',
        ...headers,
      },
    })
  },

  /**
   * Server-sent events stream. Sets the right content-type, disables
   * keep-alive buffering, and emits each event as `data: <json>\n\n`.
   *
   * @example
   * ```ts
   * return response.sse(async (send) => {
   *   for await (const tick of clock) send({ ts: Date.now() })
   * })
   * ```
   */
  sse: (
    producer: (
      send: (data: unknown, event?: string, id?: string) => void,
      controller: { close: () => void },
    ) => void | Promise<void>,
    options: { status?: number, headers?: Record<string, string> } = {},
  ): Response => {
    return response.stream(
      async (controller) => {
        let closed = false
        const send = (data: unknown, event?: string, id?: string) => {
          if (closed) return
          let chunk = ''
          if (event) chunk += `event: ${event}\n`
          if (id) chunk += `id: ${id}\n`
          chunk += `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`
          controller.enqueue(chunk)
        }
        const close = () => { closed = true; try { controller.close() } catch { /* already */ } }
        await producer(send, { close })
      },
      {
        ...options,
        contentType: 'text/event-stream',
        headers: {
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...(options.headers ?? {}),
        },
      },
    )
  },
}
