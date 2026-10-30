import type { CompleteInput, CompletionKind, ConfiguredAIOptions } from '@stacksjs/ai'

/**
 * The testable core of `POST /ai/complete`. The Action reads the request and
 * hands this its parts; everything decided here is a status and a body.
 *
 * Two answers matter to an editor drawing ghost text:
 *   - `200 { completion: '' }` is "no suggestion", and it covers a missing or
 *     disabled AI driver, so an app without AI keys never shows an error while
 *     someone types.
 *   - `502` is a real provider failure, with a message worth logging.
 */

export const COMPLETE_MAX_BEFORE = 20_000
export const COMPLETE_MAX_AFTER = 5_000
export const COMPLETE_MAX_CONTEXT = 2_000
/** Suggestions per user per minute. The client debounces; this is the backstop. */
export const COMPLETE_RATE_PER_MINUTE = 90

const KINDS: readonly CompletionKind[] = ['note', 'prompt', 'todo', 'text']

export interface CompleteRequestBody {
  before?: unknown
  after?: unknown
  kind?: unknown
  context?: unknown
}

export interface ParsedCompleteBody {
  before: string
  after: string
  kind: CompletionKind
  context: string
}

export function parseCompleteBody(body: CompleteRequestBody): { ok: true, value: ParsedCompleteBody } | { ok: false, message: string } {
  if (typeof body.before !== 'string')
    return { ok: false, message: 'The before field must be the text before the cursor.' }
  if (body.before.length > COMPLETE_MAX_BEFORE)
    return { ok: false, message: `The before field must be ${COMPLETE_MAX_BEFORE} characters or fewer.` }

  if (body.after !== undefined && body.after !== null && typeof body.after !== 'string')
    return { ok: false, message: 'The after field must be the text after the cursor.' }
  if (typeof body.after === 'string' && body.after.length > COMPLETE_MAX_AFTER)
    return { ok: false, message: `The after field must be ${COMPLETE_MAX_AFTER} characters or fewer.` }

  if (body.kind !== undefined && body.kind !== null && !KINDS.includes(body.kind as CompletionKind))
    return { ok: false, message: `The kind field must be one of ${KINDS.join(', ')}.` }

  if (body.context !== undefined && body.context !== null && typeof body.context !== 'string')
    return { ok: false, message: 'The context field must be text.' }
  if (typeof body.context === 'string' && body.context.length > COMPLETE_MAX_CONTEXT)
    return { ok: false, message: `The context field must be ${COMPLETE_MAX_CONTEXT} characters or fewer.` }

  return {
    ok: true,
    value: {
      before: body.before,
      after: typeof body.after === 'string' ? body.after : '',
      kind: (body.kind as CompletionKind | undefined | null) ?? 'text',
      context: typeof body.context === 'string' ? body.context : '',
    },
  }
}

export interface CompleteRequestDeps {
  body: CompleteRequestBody
  /** Resolves the signed-in user, or undefined. Throws when auth itself broke. */
  authenticate: () => Promise<{ id: number | string } | undefined>
  /** Consumes one slot of the user's budget; throws an HttpError(429) when spent. */
  limit: (userId: number | string) => Promise<void>
  config: ConfiguredAIOptions
  complete: (input: CompleteInput) => Promise<{ completion: string }>
  /** Whether a driver can answer at all; false answers `''` without a call. */
  available: (config: ConfiguredAIOptions) => boolean
  signal?: AbortSignal
  log?: (message: string, context: Record<string, unknown>) => void
}

export interface CompleteRequestResult {
  status: number
  body: { completion: string } | { message: string }
}

export async function handleCompleteRequest(deps: CompleteRequestDeps): Promise<CompleteRequestResult> {
  let user
  try {
    user = await deps.authenticate()
  }
  catch (error) {
    deps.log?.('[ai] Completion auth failed', { error })
    return { status: 503, body: { message: 'Authentication could not be verified.' } }
  }
  if (!user?.id)
    return { status: 401, body: { message: 'Sign in to use completions.' } }

  const parsed = parseCompleteBody(deps.body)
  if (!parsed.ok)
    return { status: 422, body: { message: parsed.message } }

  // Nothing to continue, or nowhere to ask: the same quiet answer, and no
  // budget spent.
  if (!parsed.value.before.trim() || !deps.available(deps.config))
    return { status: 200, body: { completion: '' } }

  await deps.limit(user.id)

  try {
    const { completion } = await deps.complete({ ...parsed.value, signal: deps.signal })
    return { status: 200, body: { completion } }
  }
  catch (error) {
    // The client moved on (aborted its request): not a failure to report.
    if ((error as Error)?.name === 'AbortError')
      return { status: 200, body: { completion: '' } }
    deps.log?.('[ai] Completion request failed', { error })
    return { status: 502, body: { message: 'The AI provider could not complete the text.' } }
  }
}
