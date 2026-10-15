import { config } from '@stacksjs/config'
import { PasskeyError } from '@stacksjs/auth'
export function passkeyParty() {
  const options = config.auth.passkeys
  return options?.enabled ? { origin: options.origin || config.app.url || 'http://localhost:3333', name: options.name || config.app.name || 'Stacks' } : null
}
export function passkeyFailure(error: unknown): Response {
  if (!(error instanceof PasskeyError)) throw error
  return Response.json({ error: error.message }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
}
export function passkeyJSON(value: unknown): Response {
  return Response.json(value, { headers: { 'Cache-Control': 'no-store' } })
}
