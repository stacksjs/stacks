// Hand-written, unlike its neighbours — `server-auto-imports.d.ts` is
// regenerated whenever the API starts and would lose these.
//
// What a `<script server>` block can reach (stacksjs/stacks#2232). tsc cannot
// see inside a `.stx` file, but `typecheck:views` hands this file to
// `stx typecheck` with `--lib`, so the templates are checked against it. It
// also gives an editor something to complete against.
//
// `requestContext` is typed as the object the servers install
// (`StacksRequestContext` in @stacksjs/config), not restated here. A copy of
// its methods written out in this file drifted: it had no `site()`, so a
// template calling `requestContext.site()` as core/sites/README.md tells it to
// failed `typecheck:views`. The import is relative, as the paths in
// `browser-auto-imports.d.ts` are: through `@stacksjs/config`, `stx typecheck`
// resolved the type to `any` and passed a call to a method that does not
// exist.

export {}

declare global {
  /**
   * The request this server script is rendering.
   *
   * Installed by `buddy dev` and `buddy serve` (`installRequestScope`), and
   * read from the scope each server opens for a request, so a page, its
   * layout and its components each read their own request while others are
   * in flight. Outside a request, every accessor answers with its empty
   * value rather than throwing. Only those two servers install it: in a
   * process that started neither, `requestContext` is undefined.
   */
  const requestContext: import('../core/config/src/request-context').StacksRequestContext

  /**
   * Query parameters injected onto the render context by the serve path.
   *
   * Declared optional-shaped for a reason: this is injected by
   * bun-plugin-stx's serve path only. A standalone render (the SSG path, or
   * `processDirectives` called without a request) supplies nothing, and a bare
   * `query` is a ReferenceError there rather than an empty result. Until that
   * path injects an empty-but-shaped object, reads still need a guard:
   *
   *     const params = typeof query !== 'undefined' ? query : {}
   *
   * In a process that installed `requestContext`, `requestContext.query()`
   * answers `{}` there instead.
   */
  const query: Record<string, string>

  /**
   * Cookies injected onto the render context by the serve path.
   *
   * Same caveat as `query`: absent in a standalone render, where a process
   * that installed `requestContext` answers `requestContext.cookie(name)`
   * with null.
   */
  const cookies: Record<string, string>
}
