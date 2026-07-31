export function shouldDelegateDashboardRequest(pathname: string, method: string): boolean {
  if (pathname.startsWith('/api/config/') || pathname.startsWith('/__deps/'))
    return false
  if (pathname.startsWith('/api/'))
    return true
  if (pathname.startsWith('/auth/') || pathname === '/me')
    return true
  const normalizedMethod = method.toUpperCase()
  return normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD'
}
