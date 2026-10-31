import type { ConfiguredAIOptions } from '@stacksjs/ai'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { complete, completionStatus } from '@stacksjs/ai'
import { resolveAuthenticatedUser } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import type { ResponseStatus } from '@stacksjs/router'
import { rateLimit, response } from '@stacksjs/router'
import { COMPLETE_RATE_PER_MINUTE, handleCompleteRequest } from './complete-request'

/**
 * `POST /ai/complete`: the ghost text behind an editor's Tab-to-accept.
 *
 * Body `{ before, after?, kind?: 'note' | 'prompt' | 'todo' | 'text', context? }`,
 * answer `{ completion }`. `''` means "no suggestion", including when the app
 * has no AI driver configured; a provider failure is a 502.
 *
 * Needs a signed-in user and is rate limited per user. Mount it under another
 * path with `route.post('/complete', 'Actions/AI/CompleteAction').middleware('auth')`.
 */
export default new Action({
  name: 'AiCompleteAction',
  description: 'Complete the text at the cursor with the configured AI driver',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const aiConfig = (config.ai || {}) as ConfiguredAIOptions
    const body = {
      before: request.get('before'),
      after: request.get('after'),
      kind: request.get('kind'),
      context: request.get('context'),
    }

    const result = await handleCompleteRequest({
      body,
      config: aiConfig,
      authenticate: () => resolveAuthenticatedUser(request as any),
      limit: userId => rateLimit('ai-complete', COMPLETE_RATE_PER_MINUTE, { identity: `user:${userId}` }).per('minute'),
      available: cfg => completionStatus(cfg).available,
      complete: input => complete(input, { config: aiConfig }),
      signal: (request as { signal?: AbortSignal }).signal,
      log: (message, context) => void log.error(message, context),
    })

    return response.json(result.body, result.status as ResponseStatus)
  },
})
