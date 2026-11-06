/** Shared projection boundary for model records and global search. */
const HIDDEN_COLUMNS = new Set(['password', 'remember_token', 'api_token', 'access_token', 'refresh_token', 'secret', 'two_factor_secret'])

export function hiddenModelColumns(Model: any): Set<string> {
  const hidden = new Set(HIDDEN_COLUMNS)
  for (const [name, definition] of Object.entries(Model?.attributes ?? {})) {
    if ((definition as { hidden?: boolean })?.hidden)
      hidden.add(name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase())
  }
  return hidden
}

