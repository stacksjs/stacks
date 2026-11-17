export function shouldDelegateDashboardRequest(pathname: string, method: string): boolean {
  // The dev server's own routes: the config editor, the browser bundles, and
  // the project switcher (`dashboard-projects.ts`), whose writes are POSTs
  // that must not fall through to the application's router below.
  if (pathname.startsWith('/api/config/') || pathname.startsWith('/__deps/') || pathname.startsWith('/__buddy/'))
    return false
  if (pathname.startsWith('/api/'))
    return true
  if (pathname.startsWith('/auth/') || pathname === '/me')
    return true
  const normalizedMethod = method.toUpperCase()
  return normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD'
}
