import type { WorkflowConfig } from '@stacksjs/types'
import { reviewOsWorkflows } from '@stacksjs/actions/reviewos-workflows'
import { boundedBody } from '@stacksjs/actions/library/archive'

/** The installed CLI owns interactive authentication; CI supplies a scoped key. */
export function projectWorkflowClient(config: WorkflowConfig) {
  if (process.env.REVIEWOS_TOKEN) return reviewOsWorkflows({ origin: config.origin, repository: config.repository, token: process.env.REVIEWOS_TOKEN })
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
      if (code !== 0) throw new Error(`ReviewOS refused the workflow request. ${new TextDecoder().decode(error).trim()} Use the current ReviewOS CLI and reviewos login.`)
      return new Response(new TextDecoder().decode(body), { headers: { 'content-type': 'application/json' } })
    }
    finally {
      init?.signal?.removeEventListener('abort', abort)
      if (child.exitCode === null) { child.kill(); await child.exited }
    }
  } })
}
