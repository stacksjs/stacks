import process from 'node:process'
import { log } from '@stacksjs/logging'

/**
 * MIME type mapping for common file extensions
 */
export const mimeTypes: Record<string, string> = {
  // Web assets
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.ts': 'application/javascript; charset=utf-8',
  '.mts': 'application/javascript; charset=utf-8',
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
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',

  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',

  // Documents
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',

  // Media
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.ogv': 'video/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',

  // Archives
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',

  // Other
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.yaml': 'application/x-yaml',
  '.yml': 'application/x-yaml',
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
  if (pathname.startsWith('/public/')) return true

  // Check for file extensions that indicate static assets
  const ext = pathname.substring(pathname.lastIndexOf('.')).toLowerCase()
  return ext in mimeTypes && ext !== '.html' && ext !== '.htm'
}

/**
 * Static route configuration for HTML views and assets
 */
interface StaticRouteConfig {
  /** File path or content */
  content: string | Response
  /** MIME type */
  contentType?: string
  /** Cache control header */
  cacheControl?: string
}

/**
 * StaticRouteManager - Manages static file routes for HTML views and assets
 *
 * This integrates with bun-router's static file serving while maintaining
 * Stacks-specific functionality for view routes.
 */
export class StaticRouteManager {
  /** Registered static routes */
  private staticRoutes: Record<string, StaticRouteConfig> = {}

  /** Registered asset directories */
  private assetPaths: string[] = []

  /**
   * Add an HTML file route
   *
   * @example
   * ```ts
   * staticRoute.addHtmlFile('/about', 'about.html')
   * ```
   */
  addHtmlFile(uri: string, htmlFile: string): void {
    const normalizedUri = uri.startsWith('/') ? uri : `/${uri}`
    this.staticRoutes[normalizedUri] = {
      content: htmlFile,
      contentType: 'text/html; charset=utf-8',
    }
    log.debug(`Registered HTML route: ${normalizedUri} -> ${htmlFile}`)
  }

  /**
   * Add a static asset file (CSS, JS, images, etc.)
   *
   * @example
   * ```ts
   * staticRoute.addAssetFile('/css/style.css', cssContent, 'text/css')
   * ```
   */
  addAssetFile(uri: string, file: string | Response, contentType?: string): void {
    const normalizedUri = uri.startsWith('/') ? uri : `/${uri}`
    const mime = contentType || getMimeType(normalizedUri)

    this.staticRoutes[normalizedUri] = {
      content: file,
      contentType: mime,
      cacheControl: 'public, max-age=31536000, immutable',
    }
    log.debug(`Registered asset route: ${normalizedUri}`)
  }

  /**
   * Register a directory to serve static assets from
   *
   * @example
   * ```ts
   * staticRoute.addAssetDirectory('/path/to/public')
   * ```
   */
  addAssetDirectory(basePath: string): void {
    if (!this.assetPaths.includes(basePath)) {
      this.assetPaths.push(basePath)
      log.debug(`Registered asset directory: ${basePath}`)
    }
  }

  /**
   * Get registered asset directories
   */
  getAssetPaths(): string[] {
    return [...this.assetPaths]
  }

  /**
   * Check if a URI is registered as a static route
   */
  hasRoute(uri: string): boolean {
    const normalizedUri = uri.startsWith('/') ? uri : `/${uri}`
    return normalizedUri in this.staticRoutes
  }

  /**
   * Get a static route configuration
   */
  getRoute(uri: string): StaticRouteConfig | undefined {
    const normalizedUri = uri.startsWith('/') ? uri : `/${uri}`
    return this.staticRoutes[normalizedUri]
  }

  /**
   * Get all static route configurations
   */
  getStaticConfig(): Record<string, StaticRouteConfig> {
    return { ...this.staticRoutes }
  }

  /**
   * Get static config with route imports (async version)
   *
   * @deprecated Routes are now imported separately via router.importRoutes()
   */
  async getStaticConfigAsync(): Promise<Record<string, StaticRouteConfig>> {
    // PRODUCTION BINARY MODE: Skip route imports that require external files
    if (process.env.SKIP_CONFIG_LOADING !== 'true') {
      try {
        const { route } = await import('./router')
        await route.importRoutes()
      }
      catch (error) {
        log.debug('Could not import routes for static config:', error)
      }
    }

    return this.staticRoutes
  }

  /**
   * Remove a static route
   */
  removeRoute(uri: string): boolean {
    const normalizedUri = uri.startsWith('/') ? uri : `/${uri}`
    if (normalizedUri in this.staticRoutes) {
      delete this.staticRoutes[normalizedUri]
      return true
    }
    return false
  }

  /**
   * Clear all static routes
   */
  clearRoutes(): void {
    this.staticRoutes = {}
    this.assetPaths = []
  }

  /**
   * Get the number of registered static routes
   */
  get routeCount(): number {
    return Object.keys(this.staticRoutes).length
  }
}

/**
 * Singleton static route manager instance
 */
export const staticRoute: StaticRouteManager = new StaticRouteManager()

/**
 * Helper to create cache control headers for static assets
 */
export function createCacheControlHeader(options: {
  maxAge?: number
  sMaxAge?: number
  public?: boolean
  private?: boolean
  immutable?: boolean
  noCache?: boolean
  noStore?: boolean
  mustRevalidate?: boolean
} = {}): string {
  const directives: string[] = []

  if (options.public) directives.push('public')
  if (options.private) directives.push('private')
  if (options.noCache) directives.push('no-cache')
  if (options.noStore) directives.push('no-store')
  if (options.mustRevalidate) directives.push('must-revalidate')
  if (options.maxAge !== undefined) directives.push(`max-age=${options.maxAge}`)
  if (options.sMaxAge !== undefined) directives.push(`s-maxage=${options.sMaxAge}`)
  if (options.immutable) directives.push('immutable')

  return directives.join(', ')
}
