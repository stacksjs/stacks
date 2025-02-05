export class StaticRouteManager {
  private staticRoutes: Record<string, any> = {}

  public addHtmlFile(uri: string, htmlFile: any): void {
    // Normalize the URI for static serving
    const normalizedUri = uri.startsWith('/') ? uri : `/${uri}`
    // Store the HTML file with its URI
    this.staticRoutes[normalizedUri] = htmlFile
  }

  public getStaticConfig(): Record<string, any> {
    return this.staticRoutes
  }
}
