import type { ResponseStatus } from '@stacksjs/bun-router'
import { licensing } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

/** The HTTP status each refusal answers with. Anything unlisted is a 403. */
const STATUSES: Record<string, ResponseStatus> = {
  'not-found': 404,
  'invalid-device': 422,
  'invalid-email': 422,
  'device-limit': 409,
  'seat-limit': 409,
}

export function refusal(reason: string, message: string, extra: Record<string, unknown> = {}): Response {
  return response.json({ ok: false, reason, message, ...extra }, STATUSES[reason] ?? 403)
}

/**
 * Run a licensing call, answering 503 when the app has no signing key yet
 * instead of a stack trace: a misconfigured server is not the caller's fault,
 * and a client treats a 5xx as "try again later", keeping its stored token.
 */
export async function answer(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run()
  }
  catch (error) {
    if (error instanceof licensing.LicensingNotConfiguredError) {
      console.error(`[licensing] ${error.message}`)
      return response.json({ reason: 'not-configured', message: 'Licensing is not configured on this server.' }, 503)
    }
    throw error
  }
}
