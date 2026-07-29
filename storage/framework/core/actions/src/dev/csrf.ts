import { existsSync } from 'node:fs'
import { projectPath } from '@stacksjs/path'

/**
 * Resolve the default CSRF middleware for both framework checkouts and apps
 * consuming the published defaults package.
 */
export function resolveCsrfMiddlewarePath(): string {
  const relativePath = 'app/Middleware/Csrf.ts'
  const vendoredPath = projectPath(`storage/framework/defaults/${relativePath}`)
  if (existsSync(vendoredPath))
    return vendoredPath

  try {
    const packageJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
    return `${packageJson.slice(0, packageJson.lastIndexOf('/'))}/${relativePath}`
  }
  catch {
    return vendoredPath
  }
}

/**
 * Seed the API's double-submit CSRF cookie on an STX page response.
 */
export async function seedCsrfPageResponse(
  request: Request,
  response: Response,
): Promise<Response | undefined> {
  const method = request.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD')
    return

  try {
    const { seedCsrfCookieIfMissing } = await import(resolveCsrfMiddlewarePath())
    return seedCsrfCookieIfMissing(request, response)
  }
  catch {
    // Keep the page available while the API remains fail-closed.
  }
}
