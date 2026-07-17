/** Resolve the interface used by API entrypoints in local and deployed runtimes. */
export function resolveApiHost(env: Record<string, string | undefined> = process.env): string {
  if (env.API_HOST)
    return env.API_HOST

  if (env.HOST)
    return env.HOST

  const isProduction = env.NODE_ENV === 'production' || env.APP_ENV === 'production'
  return isProduction ? '0.0.0.0' : '127.0.0.1'
}
