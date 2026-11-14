import type { HqServicesConfig } from '@stacksjs/types'

export interface SupportVerificationState { id: string, nonce: string, project: string, origin: string, expiresAt: number }
export interface SupportVerificationDeps {
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  print: (message: string) => void
  writeDocument: (document: Record<string, string>) => Promise<void>
  readState: () => Promise<unknown>
  writeState: (state: SupportVerificationState) => Promise<void>
  now?: () => number
}

class VerificationError extends Error {}

function row(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function state(value: unknown): value is SupportVerificationState {
  return row(value) && typeof value.id === 'string' && /^\d+$/.test(value.id)
    && typeof value.nonce === 'string' && /^[a-f0-9]{64}$/.test(value.nonce)
    && typeof value.project === 'string' && typeof value.origin === 'string'
    && Number.isSafeInteger(value.expiresAt)
}

/** Publish an ownership challenge, then confirm it after the consumer is deployed. */
export async function runSupportVerification(config: HqServicesConfig, originInput: string, options: { confirm?: boolean, frameworkVersion: string }, deps: SupportVerificationDeps): Promise<boolean> {
  try {
    const service = config.supporthq
    if (!service?.key || !service.project) throw new VerificationError('Connect HQ.support first with `buddy support:install`.')
    const origin = new URL(originInput)
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port || origin.search || origin.hash || origin.pathname !== '/')
      throw new VerificationError('Use the public HTTPS origin of your deployed Stacks app.')
    const base = new URL(service.url)
    if (base.username || base.password || base.hash || base.search || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))))
      throw new VerificationError('HQ.support needs HTTPS, except a local development service.')
    const endpoint = `${base.href.replace(/\/$/, '')}/api/v1/projects/${encodeURIComponent(service.project)}/verification/challenges`
    async function post(url: string, body: unknown): Promise<unknown> {
      const response = await deps.fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${service!.key}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new VerificationError(`HQ.support refused verification (${response.status}).`)
      return await response.json()
    }
    if (options.confirm) {
      const current = await deps.readState()
      if (!state(current) || current.project !== service.project || current.origin !== origin.origin || current.expiresAt <= (deps.now ?? Date.now)())
        throw new VerificationError('Start a new challenge for this project and origin before confirming.')
      const answer = await post(`${endpoint}/${encodeURIComponent(current.id)}/confirm`, { nonce: current.nonce })
      if (!row(answer) || answer.verified !== true || answer.plan !== 'free') throw new VerificationError('HQ.support did not confirm the free workspace.')
      deps.print('Stacks Free verified: 2 agents, 100 conversations + 20% grace, 10 text AI conversations, 300 MB attachments (10 MB/file).')
      return true
    }
    const answer = await post(endpoint, { origin: origin.origin, frameworkVersion: options.frameworkVersion })
    if (!row(answer) || !state(answer.challenge) || !row(answer.document)) throw new VerificationError('HQ.support returned an invalid challenge.')
    const challenge = answer.challenge
    const document = answer.document
    if (challenge.project !== service.project || challenge.origin !== origin.origin || challenge.expiresAt <= (deps.now ?? Date.now)()
      || document.service !== 'supporthq' || document.project !== service.project || document.nonce !== challenge.nonce
      || document.framework !== 'stacks' || document.frameworkVersion !== options.frameworkVersion)
      throw new VerificationError('HQ.support returned a challenge for a different installation.')
    await deps.writeDocument({ service: 'supporthq', project: service.project, nonce: challenge.nonce, framework: 'stacks', frameworkVersion: options.frameworkVersion })
    await deps.writeState({ id: challenge.id, nonce: challenge.nonce, project: challenge.project, origin: challenge.origin, expiresAt: challenge.expiresAt })
    deps.print('Created public/.well-known/hq-support. Deploy this file with your app, then confirm before the ten-minute challenge expires:')
    deps.print(`buddy support:verify ${origin.origin} --confirm`)
    deps.print('The domain proves deployment ownership; the framework version is a self-reported eligibility signal.')
    return true
  }
  catch (error) {
    // Deliberately do not print provider/network exception text or response bodies.
    deps.print(error instanceof VerificationError
      ? error.message : 'HQ.support verification could not complete. No free allowance was claimed.')
    return false
  }
}
