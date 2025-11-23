import { route } from './'

/**
 * MIME type mapping for common file extensions
 */
const mimeTypes: Record<string, string> = {
  // Web assets
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',

  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.avif': 'image/avif',

  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',

  // Documents
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',

  // Media
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',

  // Other
  '.wasm': 'application/wasm',
  '.map': 'application/json',
}

/**
 * Get MIME type for a file extension
 */
export function getMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Check if a path is a static asset request
 */
export function isStaticAssetPath(pathname: string): boolean {
  // Check for common asset patterns
  if (pathname.startsWith('/assets/')) return true
  if (pathname.startsWith('/_assets/')) return true
  if (pathname.startsWith('/static/')) return true

  // Check for file extensions that indicate static assets
  const ext = pathname.substring(pathname.lastIndexOf('.')).toLowerCase()
  return ext in mimeTypes && ext !== '.html' && ext !== '.htm'
}

export class StaticRouteManager {
  private staticRoutes: Record<string, any> = {}
  private assetPaths: string[] = []

  public addHtmlFile(uri: string, htmlFile: any): void {
    // Normalize the URI for static serving
    const normalizedUri = uri.startsWith('/') ? uri : `/${uri}`
    // Store the HTML file with its URI
    this.staticRoutes[normalizedUri] = htmlFile
  }

  /**
   * Add a static asset file (CSS, JS, images, etc.)
   */
  public addAssetFile(uri: string, file: any, contentType?: string): void {
    const normalizedUri = uri.startsWith('/') ? uri : `/${uri}`
    // If contentType not provided, determine from extension
    const mime = contentType || getMimeType(normalizedUri)
    this.staticRoutes[normalizedUri] = new Response(file, {
      headers: { 'Content-Type': mime },
    })
  }

  /**
   * Register a directory to serve static assets from
   */
  public addAssetDirectory(basePath: string): void {
    this.assetPaths.push(basePath)
  }

  /**
   * Get registered asset directories
   */
  public getAssetPaths(): string[] {
    return this.assetPaths
  }

  public async getStaticConfig(): Promise<Record<string, any>> {
    await route.importRoutes()

    return this.staticRoutes
  }
}

export const staticRoute: StaticRouteManager = new StaticRouteManager()
