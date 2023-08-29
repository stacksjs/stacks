interface RequestData {
  [key: string]: string
}

type RouteParams = { [key: string]: string } | null

export class Request {
  private query: { [key: string]: string } = {}
  private params: RouteParams = null

  public addQuery(url: URL): void {
    const query = url.searchParams

    const paramObject: RequestData = {}

    for (const [key, value] of query.entries())
      paramObject[key] = value

    this.query = paramObject
  }

  public get(element: string): string | number | undefined {
    return this.query[element]
  }

  public all(): { [key: string]: string } {
    return this.query
  }

  public has(element: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.query, element)
  }

  public isEmpty(): boolean {
    return Object.keys(this.query).length === 0
  }

  public extractParamsFromRoute(routePattern: string, pathname: string): void {
    const pattern = new RegExp(`^${routePattern.replace(/:(\w+)/g, (match, paramName) => `(?<${paramName}>\\w+)`)}$`)
    const match = pattern.exec(pathname)

    if (match?.groups)
      this.params = match?.groups
  };

  public getParams(key: string): number | string | null {
    return this.params ? (this.params[key] || null) : null
  }
}

export const request = new Request()
