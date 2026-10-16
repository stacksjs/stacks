/** One authorized operation shared by HTTP endpoints, MCP tools and jobs. */
export interface ApiOperation<Context, Result> {
  /** Authorization runs on every invocation, regardless of its transport. */
  execute: (context: Context) => Promise<Result>
}

export function defineApiOperation<Context, Result>(options: {
  authorize: (context: Context) => void | Promise<void>
  handle: (context: Context) => Result | Promise<Result>
}): ApiOperation<Context, Result> {
  return Object.freeze({
    async execute(context: Context): Promise<Result> {
      await options.authorize(context)
      return options.handle(context)
    },
  })
}
