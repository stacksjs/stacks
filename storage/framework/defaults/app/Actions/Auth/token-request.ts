export function normalizeTokenExpiry(value: unknown, fallback = 60): number | null {
  const minutes = Number(value ?? fallback)
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 525600)
    return null
  return minutes
}

export function normalizeTokenScopes(value: unknown): string[] {
  const scopes = Array.isArray(value)
    ? value.map(String)
    : typeof value === 'string'
      ? value.split(',')
      : ['*']

  return [...new Set(scopes.map(scope => scope.trim()))]
    .filter(scope => scope === '*' || /^[a-z][a-z0-9:_-]{0,63}$/i.test(scope))
    .slice(0, 20)
}

export function wantsRefreshToken(value: unknown): boolean {
  return value !== false && value !== 'false'
}

/**
 * The requested scopes the calling token does not itself hold.
 *
 * A token must not be able to mint a token that can do more than it can.
 * Without this, a token issued for one scope (`deploy:run`) could call the
 * create endpoint, ask for `*` or simply omit `scopes` (which defaults to
 * `*`), and walk away with a full-access token for the same account: a scoped
 * token would be a full session with one extra request.
 *
 * `held` is the calling token's scopes, or `null` when the request was not
 * authenticated by a token at all (a cookie session), which may grant
 * anything. A token holding `*` may grant anything too.
 */
export function scopesBeyond(held: readonly string[] | null | undefined, requested: readonly string[]): string[] {
  if (!held || held.includes('*'))
    return []
  return requested.filter(scope => scope === '*' || !held.includes(scope))
}
