/**
 * A recording stand-in for `fetch`, for driver tests that cannot reach a
 * search server. Each call is recorded with its method, URL, headers and body,
 * and answered by `respond` (a 200 `{}` by default).
 */
export interface RecordedRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: string | undefined
  /** `body` parsed as JSON, when it is JSON. */
  json: any
}

export interface FetchStub {
  requests: RecordedRequest[]
  restore: () => void
}

export function stubFetch(
  respond: (request: RecordedRequest) => Response | Promise<Response> = () => Response.json({}),
): FetchStub {
  const original = globalThis.fetch
  const requests: RecordedRequest[] = []

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((value, key) => { headers[key] = value })
    const body = typeof init?.body === 'string' ? init.body : undefined
    let json: any
    try { json = body === undefined ? undefined : JSON.parse(body) }
    catch { json = undefined }
    const recorded = { method: init?.method ?? 'GET', url, headers, body, json }
    requests.push(recorded)
    return await respond(recorded)
  }) as typeof fetch

  return { requests, restore: () => { globalThis.fetch = original } }
}
