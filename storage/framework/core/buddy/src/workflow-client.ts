import type { WorkflowConfig } from '@stacksjs/types'
import { reviewOsWorkflows } from '@stacksjs/actions/reviewos-workflows'
import { boundedBody } from '@stacksjs/actions/library/archive'

const retryableConnectionCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN', 'ConnectionClosed'])

class InterruptedWorkflowRead extends Error {}

/** Only retry recognized interruptions, before interpreting any workflow evidence. */
export function isInterruptedWorkflowRead(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const failure = error as Error & { code?: string, cause?: { code?: string } }
  return error instanceof InterruptedWorkflowRead
    || error.name === 'TimeoutError'
    || retryableConnectionCodes.has(failure.code ?? failure.cause?.code ?? '')
    || /^ReviewOS workflow request blocked: Metadata API returned HTTP (502|503|504)$/.test(error.message)
}

/** The installed CLI owns interactive authentication; CI supplies a scoped key. */
export function projectWorkflowClient(config: WorkflowConfig) {
  if (process.env.REVIEWOS_TOKEN) return reviewOsWorkflows({ origin: config.origin, repository: config.repository, token: process.env.REVIEWOS_TOKEN })
  const instance = config.origin.replace(/\/$/, '')
  return reviewOsWorkflows({ origin: config.origin, repository: config.repository, fetch: async (input, init) => {
    const url = new URL(String(input))
    const argv = ['reviewos', 'api', url.pathname + url.search, '--instance', config.origin, '--method', init?.method ?? 'GET']
    if (init?.body !== undefined) argv.push('--body', '-')
    if (init?.signal?.aborted) throw new Error('Workflow request cancelled')
    const child = Bun.spawn(argv, { stdin: init?.body === undefined ? 'ignore' : new TextEncoder().encode(String(init.body)), stdout: 'pipe', stderr: 'pipe', timeout: 30000 })
    const abort = () => { child.kill() }
    init?.signal?.addEventListener('abort', abort, { once: true })
    try {
      const [body, error, code] = await Promise.all([boundedBody(new Response(child.stdout), 1_048_576), boundedBody(new Response(child.stderr), 65536), child.exited])
      if (code !== 0) {
        const diagnostics = new TextDecoder().decode(error).trim()
        const firstLine = diagnostics.split('\n', 1)[0] ?? ''
        const connectionPrefix = `Could not reach ${instance}: `
        const connectionCode = firstLine.startsWith(connectionPrefix) ? firstLine.slice(connectionPrefix.length).split(':', 1)[0] ?? '' : ''
        if ((init?.method ?? 'GET') === 'GET' && (
          retryableConnectionCodes.has(connectionCode)
          || /^The server answered (502|503|504)$/.test(firstLine)
          || firstLine === `The response from ${instance} was interrupted before it finished.`
          || init?.signal?.reason?.name === 'TimeoutError'
        )) throw new InterruptedWorkflowRead(firstLine || 'ReviewOS workflow read timed out')
        throw new Error(`ReviewOS refused the workflow request. ${diagnostics} Use the current ReviewOS CLI and reviewos login.`)
      }
      return new Response(new TextDecoder().decode(body), { headers: { 'content-type': 'application/json' } })
    }
    finally {
      init?.signal?.removeEventListener('abort', abort)
      if (child.exitCode === null) { child.kill(); await child.exited }
    }
  } })
}
