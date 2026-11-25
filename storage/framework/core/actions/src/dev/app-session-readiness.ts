import process from 'node:process'

const readyPath = '/__buddy/dev-worker-ready'
const readyHeader = 'x-stacks-dev-worker'

/** Tell the supervisor to use the worker's readiness protocol before binding. */
export async function beginDevWorkerReadiness(): Promise<string | undefined> {
  const token = process.env.STACKS_DEV_READY_TOKEN
  if (!token || process.env.STACKS_DEV_RELAY_WORKER !== '1' || !process.send)
    return

  const { promise, resolve } = Promise.withResolvers<void>()
  const acknowledge = (message: unknown) => {
    if (message && typeof message === 'object' && 'type' in message && message.type === 'stacks:dev-readiness-ack') {
      process.off('message', acknowledge)
      resolve()
    }
  }
  process.on('message', acknowledge)
  process.send({ type: 'stacks:dev-readiness-required' })
  await promise
  return token
}

export function devWorkerReadyResponse(request: Request, token: string | undefined): Response | undefined {
  if (token && request.method === 'HEAD' && request.headers.get(readyHeader) === token
    && new URL(request.url).pathname === readyPath)
    return new Response(null, { status: 204, headers: { [readyHeader]: token, 'cache-control': 'no-store' } })
}

export async function waitForDevFrontendReady(port: number, token: string, signal: AbortSignal): Promise<boolean> {
  while (!signal.aborted) {
    const response = await fetch(`http://127.0.0.1:${port}${readyPath}`, {
      method: 'HEAD',
      headers: { [readyHeader]: token, connection: 'close' },
      redirect: 'manual',
      signal: AbortSignal.any([signal, AbortSignal.timeout(800)]),
    }).catch(() => null)
    if (response?.status === 204 && response.headers.get(readyHeader) === token)
      return true
    await Bun.sleep(50)
  }
  return false
}
