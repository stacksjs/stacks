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
  const declared = request.headers.get('content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes))
    throw new RequestBodyError('Request body is too large', 413)
  if (!request.body)
    throw new RequestBodyError('Send a JSON body', 400)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        void reader.cancel().catch(() => {})
        throw new RequestBodyError('Request body is too large', 413)
      }
      chunks.push(value)
    }
  }
  finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  catch { throw new RequestBodyError('Send valid UTF-8 JSON', 400) }
}
