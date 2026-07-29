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
