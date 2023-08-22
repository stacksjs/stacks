export class Request {
  private static params: any = {}

  public static addParams(url: URL): void {
    const params = url.searchParams

    const paramObject: { [key: string]: string } = {}

    for (const [key, value] of params.entries())
      paramObject[key] = value

    this.params = paramObject
  }

  public static get(element: string): number | string | boolean {
    return this.params[element]
  }

  public static all(): number | string | boolean {
    return this.params
  }

  public static has(element: string): number | string | boolean {
    return this.params.hasOwnProperty(element)
  }
}
