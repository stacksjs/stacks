import type { PairedSample } from './paired'

const EXPECTED_BODY = '{"ready":true}'
const EXPECTED_MEDIA_TYPE = 'application/json'

export interface ListenHandshake {
  port: number
  rssBytes: number
}

export interface ListenSample extends PairedSample {
  firstResponseMs: number
  listenMs: number
  response: {
    bodySha256: string
    mediaType: string
    status: number
  }
  rssBytes: number
}

export interface ListenProcessOptions {
  command: string[]
  cwd: string
  env: Record<string, string>
  expectedBody?: string
  expectedMediaType?: string
  expectedStatus?: number
  headers?: Record<string, string>
  path?: string
  timeoutMs?: number
}

interface FirstLine {
  line: string
  reader: ReadableStreamDefaultReader<Uint8Array>
  remainder: string
}

function sha256(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex')
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  }
  finally {
    if (timer) clearTimeout(timer)
  }
}

async function readFirstLine(stream: ReadableStream<Uint8Array>, timeoutMs: number): Promise<FirstLine> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const deadline = performance.now() + timeoutMs
  while (true) {
    const remaining = deadline - performance.now()
    if (remaining <= 0)
      throw new Error(`Router process did not report readiness within ${timeoutMs}ms`)
    const result = await withTimeout(reader.read(), remaining, `Router process did not report readiness within ${timeoutMs}ms`)
    if (result.done)
      throw new Error('Router process exited before reporting readiness')
    buffer += decoder.decode(result.value, { stream: true })
    const newline = buffer.indexOf('\n')
    if (newline >= 0) {
      return {
        line: buffer.slice(0, newline),
        reader,
        remainder: buffer.slice(newline + 1),
      }
    }
  }
}

async function drain(reader: ReadableStreamDefaultReader<Uint8Array>, initial: string): Promise<string> {
  const decoder = new TextDecoder()
  let output = initial
  while (true) {
    const result = await reader.read()
    if (result.done) return output + decoder.decode()
    output += decoder.decode(result.value, { stream: true })
  }
}

export function parseListenHandshake(line: string): ListenHandshake {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  }
  catch {
    throw new Error(`Router process produced a malformed readiness handshake: ${line}`)
  }
  if (!parsed || typeof parsed !== 'object')
    throw new Error('Router readiness handshake must be an object')
  const handshake = parsed as Partial<ListenHandshake>
  if (!Number.isSafeInteger(handshake.port) || handshake.port! < 1 || handshake.port! > 65_535)
    throw new Error('Router readiness handshake contains an invalid port')
  if (!Number.isSafeInteger(handshake.rssBytes) || handshake.rssBytes! <= 0)
    throw new Error('Router readiness handshake contains an invalid RSS value')
  return { port: handshake.port!, rssBytes: handshake.rssBytes! }
}

export async function measureListenProcess(options: ListenProcessOptions): Promise<Omit<ListenSample, keyof PairedSample>> {
  const timeoutMs = options.timeoutMs ?? 10_000
  const expectedBody = options.expectedBody ?? EXPECTED_BODY
  const expectedMediaType = options.expectedMediaType ?? EXPECTED_MEDIA_TYPE
  const expectedStatus = options.expectedStatus ?? 200
  const path = options.path ?? '/ready'
  const started = performance.now()
  const child = Bun.spawn(options.command, {
    cwd: options.cwd,
    env: options.env,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stderrPromise = new Response(child.stderr).text()
  let firstLine: FirstLine | undefined
  let measurement: Omit<ListenSample, keyof PairedSample> | undefined
  let failure: unknown
  let terminatedByParent = false
  try {
    firstLine = await readFirstLine(child.stdout, timeoutMs)
    const handshake = parseListenHandshake(firstLine.line)
    const listenMs = performance.now() - started
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(`http://127.0.0.1:${handshake.port}${path}`, {
        headers: options.headers,
        signal: controller.signal,
      })
      const body = await response.text()
      const mediaType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? ''
      if (response.status !== expectedStatus || mediaType !== expectedMediaType || body !== expectedBody)
        throw new Error(`Router readiness probe returned ${response.status} ${mediaType || '(no media type)'} ${JSON.stringify(body)}`)
      measurement = {
        listenMs,
        firstResponseMs: performance.now() - started,
        rssBytes: handshake.rssBytes,
        response: {
          status: response.status,
          mediaType,
          bodySha256: sha256(body),
        },
      }
    }
    finally {
      clearTimeout(timer)
    }
  }
  catch (error) {
    failure = error
  }
  finally {
    if (child.exitCode == null) {
      terminatedByParent = true
      child.kill('SIGTERM')
    }
  }

  let exitCode: number
  try {
    exitCode = await withTimeout(child.exited, 2_000, 'Router process did not stop after SIGTERM')
  }
  catch (error) {
    if (child.exitCode == null) child.kill('SIGKILL')
    await child.exited
    throw error
  }
  const [stderr, trailingStdout] = await Promise.all([
    stderrPromise,
    firstLine ? drain(firstLine.reader, firstLine.remainder) : Promise.resolve(''),
  ])
  if (stderr.trim())
    throw new Error(`Router process wrote to stderr: ${stderr.trim()}`)
  if (trailingStdout.trim())
    throw new Error(`Router process wrote unexpected output after readiness: ${trailingStdout.trim()}`)
  if (failure) throw failure
  if (exitCode !== 0 && !(terminatedByParent && exitCode === 128 + 15))
    throw new Error(`Router process exited with code ${exitCode}`)
  if (!measurement)
    throw new Error('Router process completed without a readiness measurement')
  return measurement
}
