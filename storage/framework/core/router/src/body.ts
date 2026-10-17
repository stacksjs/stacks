/** Bounded body reads for protocol handlers that need the original wire body. */
export class RequestBodyError extends Error {
  constructor(message: string, readonly status: 400 | 413 | 415) {
    super(message)
    this.name = 'RequestBodyError'
  }
}

export async function readJsonBody(request: Request, maxBytes = 1_048_576): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
    throw new RangeError('maxBytes must be a positive safe integer')
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json')
    throw new RequestBodyError('Content-Type must be application/json', 415)
  const text = await readTextBody(request, maxBytes)
  try { return JSON.parse(text) }
  catch { throw new RequestBodyError('Send valid UTF-8 JSON', 400) }
}

/** Bounded UTF-8 for form and text protocols, counted from actual streamed bytes. */
export async function readTextBody(request: Request, maxBytes = 1_048_576): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
    throw new RangeError('maxBytes must be a positive safe integer')
  const declared = request.headers.get('content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes))
    throw new RequestBodyError('Request body is too large', 413)
  if (!request.body)
    throw new RequestBodyError('Send a request body', 400)
  const reader = request.body.getReader()
  let bytes = new Uint8Array(Math.min(maxBytes, 8192))
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const offset = size
      size += value.byteLength
      if (size > maxBytes) {
        void reader.cancel().catch(() => {})
        throw new RequestBodyError('Request body is too large', 413)
      }
      if (size > bytes.length) {
        const grown = new Uint8Array(Math.min(maxBytes, Math.max(size, bytes.length * 2)))
        grown.set(bytes)
        bytes = grown
      }
      bytes.set(value, offset)
    }
  }
  finally {
    reader.releaseLock()
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)) }
  catch { throw new RequestBodyError('Send valid UTF-8', 400) }
}
