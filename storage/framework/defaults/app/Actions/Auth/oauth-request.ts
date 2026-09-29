export function oauthPositiveId(value: number | string): number | null {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function oauthStringList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
    ? value
    : null
}
