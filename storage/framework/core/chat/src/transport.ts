/** A failed acknowledgement is different from a provider rejection. */
export type DeliveryOutcome = 'accepted' | 'rejected' | 'unknown'

export interface ChatTransportOptions {
  /** Scoped transport, useful for proxies and protocol fixtures; never changes another driver. */
  fetch?: typeof fetch
}

export class ChatTransportError extends Error {
  constructor(message: string, public readonly outcome: 'rejected' | 'unknown', public readonly httpStatus?: number, public readonly retryAfterMs?: number) {
    super(message)
    this.name = 'ChatTransportError'
  }
}

export async function chatRequest(fetcher: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetcher(url, { ...init, redirect: 'error', signal: init.signal ?? AbortSignal.timeout(15000) })
  }
  catch {
    // A timeout/disconnect can happen AFTER the provider accepted the POST.
    throw new ChatTransportError('Provider acknowledgement unavailable', 'unknown')
  }
  if (!response.ok) {
    const retrySeconds = Number(response.headers.get('retry-after'))
    throw new ChatTransportError(`Provider HTTP ${response.status}`, response.status >= 500 || response.status === 408 ? 'unknown' : 'rejected', response.status,
      response.status === 429 && Number.isFinite(retrySeconds) && retrySeconds >= 0 ? Math.min(retrySeconds * 1000, 30000) : undefined)
  }
  return response
}

export async function chatJson<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T
  }
  catch {
    throw new ChatTransportError('Provider acknowledgement is not valid JSON', 'unknown', response.status)
  }
}
