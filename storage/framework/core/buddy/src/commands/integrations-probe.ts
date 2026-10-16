import type { CLI } from '@stacksjs/types'
import process from 'node:process'

/**
 * `buddy integrations:probe` - ask every third-party endpoint this framework
 * calls whether it is still there (stacksjs/stacks#2859).
 *
 * The companion to `tests/third-party-api-versions.test.ts`, which pins the
 * version surface and runs on every pull request. That test cannot see this
 * failure mode: an endpoint can be withdrawn with our source unchanged, and the
 * first report is then a user whose notification never arrives. Equally, this
 * cannot see the one the test catches, because a version that has expired and
 * is being silently upgraded answers exactly as a current one. Neither replaces
 * the other.
 *
 * It runs on a schedule rather than per pull request. Probing third parties on
 * every PR means someone else's outage or rate limit fails our builds, and a
 * check that fails for reasons the author cannot fix is a check that gets
 * disabled.
 *
 * **No credential is ever sent.** That is the whole method: an endpoint that
 * exists answers an unauthenticated request with 401, 403, or a complaint about
 * the body, and one that is gone answers 404. So the absence of a credential is
 * what makes the signal readable, and it also means none of the POSTs below can
 * have an effect - each is rejected before anything is read.
 */

export interface ProbeTarget {
  /** The integration, named as #2859 names it. */
  name: string
  url: string
  method: 'GET' | 'POST'
  /**
   * The status this answered when it was added, recorded so a change is
   * legible: a target that moves from 401 to 400 is fine, and one that moves to
   * 404 is the entire point of this command.
   */
  observed: number
}

/**
 * Every endpoint whose disappearance would break something, with a URL that
 * answers without a credential.
 *
 * Each `observed` value was measured, not assumed. Several are deliberately
 * incomplete requests - a POST with no body, a project id that does not exist -
 * because the question is only whether the route is there.
 */
export const PROBE_TARGETS: ProbeTarget[] = [
  { name: 'FCM HTTP v1', url: 'https://fcm.googleapis.com/v1/projects/stacks-probe/messages:send', method: 'POST', observed: 401 },
  { name: 'OpenAI', url: 'https://api.openai.com/v1/models', method: 'GET', observed: 401 },
  { name: 'Anthropic', url: 'https://api.anthropic.com/v1/messages', method: 'POST', observed: 401 },
  { name: 'SendGrid', url: 'https://api.sendgrid.com/v3/mail/send', method: 'POST', observed: 401 },
  { name: 'Twilio', url: 'https://api.twilio.com/2010-04-01/Accounts', method: 'GET', observed: 401 },
  { name: 'Twilio Lookups v2', url: 'https://lookups.twilio.com/v2/PhoneNumbers/+15005550006', method: 'GET', observed: 401 },
  { name: 'Twilio Verify v2', url: 'https://verify.twilio.com/v2/Services', method: 'GET', observed: 401 },
  // The keys social sign-in verifies Apple and Google id_tokens against
  // (stacksjs/stacks#2907). Both are public, so a healthy answer is the
  // document itself rather than an auth error.
  { name: 'Google id_token signing keys', url: 'https://www.googleapis.com/oauth2/v3/certs', method: 'GET', observed: 200 },
  { name: 'Google tokeninfo', url: 'https://oauth2.googleapis.com/tokeninfo', method: 'GET', observed: 400 },
  { name: 'Apple id_token signing keys', url: 'https://appleid.apple.com/auth/keys', method: 'GET', observed: 200 },
  { name: 'Discord', url: 'https://discord.com/api/v10/users/@me', method: 'GET', observed: 401 },
  // Not an addon by name: a target that depends on one extension still being
  // listed would read as a sunset the day it is taken down.
  { name: 'Mozilla add-ons v5', url: 'https://addons.mozilla.org/api/v5/addons/search/?q=test', method: 'GET', observed: 200 },
  { name: 'Hetzner Cloud', url: 'https://api.hetzner.cloud/v1/servers', method: 'GET', observed: 401 },
  { name: 'fiskaly SIGN DE v2', url: 'https://kassensichv-middleware.fiskaly.com/api/v2/tss', method: 'GET', observed: 401 },
  { name: 'Lemon Squeezy', url: 'https://api.lemonsqueezy.com/v1/products', method: 'GET', observed: 401 },
  { name: 'Vonage Messages v1', url: 'https://api.nexmo.com/v1/messages', method: 'POST', observed: 401 },
  { name: 'Vonage Verify v2', url: 'https://api.nexmo.com/v2/verify', method: 'POST', observed: 422 },
  { name: 'Expo push', url: 'https://exp.host/--/api/v2/push/send', method: 'POST', observed: 400 },
  { name: 'Threads', url: 'https://graph.threads.net/v1.0/me', method: 'GET', observed: 400 },
  { name: 'Meta Graph', url: 'https://graph.facebook.com/v24.0/me', method: 'GET', observed: 400 },
  { name: 'LinkedIn', url: 'https://api.linkedin.com/rest/me', method: 'GET', observed: 401 },
  { name: 'GitHub', url: 'https://api.github.com/user', method: 'GET', observed: 401 },
]

/**
 * Paths that must read as gone, which is what makes a clean run mean anything.
 *
 * Without these the command cannot tell "nothing we call has been withdrawn"
 * from "nothing can reach the internet, or something is answering for it". A
 * captive portal, a corporate proxy or an interception appliance can return 200
 * or 403 for every URL on earth, under which every target reads as alive and
 * the run is quietly, confidently wrong.
 *
 * Three hosts, so one provider changing how it reports a missing path does not
 * silence the check. The first is the real decommissioned FCM endpoint, which
 * doubles as evidence that a withdrawn endpoint does read as 404 here; the
 * other two are paths that cannot exist.
 */
export const PROBE_CONTROLS: ProbeTarget[] = [
  { name: 'FCM legacy send (decommissioned 2024-06-20)', url: 'https://fcm.googleapis.com/fcm/send', method: 'POST', observed: 404 },
  { name: 'GitHub, a path that cannot exist', url: 'https://api.github.com/stacks-probe-control-does-not-exist', method: 'GET', observed: 404 },
  { name: 'OpenAI, a path that cannot exist', url: 'https://api.openai.com/v1/stacks-probe-control-does-not-exist', method: 'GET', observed: 404 },
]

export type Verdict = 'alive' | 'gone' | 'inconclusive'

/**
 * What a status says about whether the endpoint is still there.
 *
 * The distinction this exists to draw is the one from #2856: the
 * decommissioned FCM endpoint answers 404 where its replacement answers 401.
 */
export function classifyStatus(status: number | null): Verdict {
  // No answer at all: a timeout, a DNS failure, a reset connection. It says
  // nothing about the endpoint, and reading it as death is how a probe earns
  // itself a mute button.
  if (status === null)
    return 'inconclusive'

  // The two ways a provider says "not here".
  if (status === 404 || status === 410)
    return 'gone'

  // The provider is having a bad day. Not a sunset.
  if (status >= 500)
    return 'inconclusive'

  // Everything else means something answered for this path. 401 and 403 are an
  // auth check, which only a route that exists can perform; 400 and 422 mean
  // the deliberately incomplete request was read; 429 means we were counted.
  return 'alive'
}

export interface ProbeResult {
  target: ProbeTarget
  status: number | null
  verdict: Verdict
}

export type Conclusion = 'ok' | 'withdrawn' | 'untrustworthy' | 'inconclusive'

/** What the run as a whole establishes, controls first. */
export function concludeProbe(targets: ProbeResult[], controls: ProbeResult[]): Conclusion {
  // The controls decide whether anything else can be believed, so they are read
  // before the targets and a missing set of them is not a pass.
  if (controls.length === 0)
    return 'untrustworthy'
  if (controls.some(result => result.verdict !== 'gone'))
    return 'untrustworthy'

  if (targets.some(result => result.verdict === 'gone'))
    return 'withdrawn'
  // Something did not answer. Worth saying, not worth waking anyone.
  if (targets.some(result => result.verdict === 'inconclusive'))
    return 'inconclusive'
  return 'ok'
}

/** 0 says nothing is wrong, 1 says something we call is gone, 2 says ask again. */
export function exitCodeFor(conclusion: Conclusion): number {
  if (conclusion === 'withdrawn')
    return 1
  if (conclusion === 'ok')
    return 0
  return 2
}

export function renderReport(targets: ProbeResult[], controls: ProbeResult[], conclusion: Conclusion): string {
  const row = (result: ProbeResult): string => {
    const status = result.status === null ? 'no answer' : String(result.status)
    const moved = result.status !== null && result.status !== result.target.observed ? ` (was ${result.target.observed})` : ''
    return `| ${result.target.name} | ${result.target.method} | ${status}${moved} | ${result.verdict} |`
  }

  const headline = {
    ok: 'Every endpoint this framework calls is still answering.',
    withdrawn: 'An endpoint this framework calls has been withdrawn.',
    untrustworthy: 'This run proves nothing: a control that must read as gone did not, so something is answering for the network.',
    inconclusive: 'No conclusion: something did not answer. The controls were sound, so this is likely a transient failure.',
  }[conclusion]

  return [
    `## Integration sunset probe`,
    '',
    headline,
    '',
    '| Endpoint | Method | Status | Verdict |',
    '| --- | --- | --- | --- |',
    ...targets.map(row),
    '',
    '### Controls',
    '',
    'Paths that must read as gone. If any does not, the table above says nothing.',
    '',
    '| Control | Method | Status | Verdict |',
    '| --- | --- | --- | --- |',
    ...controls.map(row),
    '',
    'No credential is sent by any request here, which is what makes the signal readable: an endpoint that exists rejects an unauthenticated request, and one that is gone answers 404.',
  ].join('\n')
}

/** One request, with no credential and a bounded wait. */
async function probe(target: ProbeTarget, timeoutMs: number): Promise<ProbeResult> {
  try {
    const response = await fetch(target.url, {
      method: target.method,
      // No Authorization, no api key, no body. See the file comment.
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })
    return { target, status: response.status, verdict: classifyStatus(response.status) }
  }
  catch {
    return { target, status: null, verdict: 'inconclusive' }
  }
}

/** A few at a time, because this is someone else's service. */
async function probeAll(targets: ProbeTarget[], timeoutMs: number, concurrency = 4): Promise<ProbeResult[]> {
  const results: ProbeResult[] = []
  for (let index = 0; index < targets.length; index += concurrency)
    results.push(...await Promise.all(targets.slice(index, index + concurrency).map(target => probe(target, timeoutMs))))
  return results
}

export function integrationsProbe(buddy: CLI): void {
  buddy
    .command('integrations:probe', 'Check whether the third-party endpoints this framework calls still exist (sends no credentials)')
    .option('--timeout <ms>', 'How long to wait for each endpoint', { default: '12000' })
    .option('--json', 'Print the results as JSON instead of a report', { default: false })
    .action(async (options: { timeout?: string, json?: boolean }) => {
      const timeoutMs = Number.parseInt(String(options.timeout ?? '12000'), 10) || 12_000

      // Controls first: if they fail there is no point reporting on the rest as
      // though it meant something.
      const controls = await probeAll(PROBE_CONTROLS, timeoutMs)
      const targets = await probeAll(PROBE_TARGETS, timeoutMs)
      const conclusion = concludeProbe(targets, controls)

      if (options.json)
        console.log(JSON.stringify({ conclusion, targets, controls }, null, 2))
      else
        console.log(renderReport(targets, controls, conclusion))

      process.exit(exitCodeFor(conclusion))
    })
}
