import process from 'node:process'

function configuredApplicationUrl(): string {
  const frontendUrl = process.env.FRONTEND_APP_URL?.trim()
  if (frontendUrl && !frontendUrl.includes('${'))
    return frontendUrl

  return process.env.APP_URL?.trim() || 'http://localhost:3000'
}

function withProtocol(baseUrl: string): string {
  if (/^https?:\/\//i.test(baseUrl))
    return baseUrl

  const host = baseUrl.split('/')[0].split(':')[0].toLowerCase()
  const protocol = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(host)
    ? 'http'
    : 'https'
  return `${protocol}://${baseUrl}`
}

/** Build an absolute URL for a page served by the public Stacks application. */
export function publicApplicationUrl(pathname = '/', baseUrl = configuredApplicationUrl()): string {
  const normalizedBase = withProtocol(baseUrl.trim()).replace(/\/+$/, '')
  const normalizedPath = pathname.replace(/^\/+/, '')
  return new URL(normalizedPath, `${normalizedBase}/`).toString()
}
