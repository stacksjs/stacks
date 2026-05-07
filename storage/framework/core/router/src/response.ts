/**
 * The `response` factory is re-exported from `@stacksjs/bun-router` —
 * see `./index.ts`'s `export * from '@stacksjs/bun-router'` line. Look
 * there (or at the bun-router source) for the canonical shape:
 *
 *     response.json(data, options?)
 *     response.text(content, status?, headers?)
 *     response.xml(content, status?, headers?)
 *     response.html(content, status?, headers?)
 *     response.redirect(url, status?)
 *     response.notFound(message?)
 *     response.unauthorized(message?)
 *     response.forbidden(message?)
 *     response.tooManyRequests(message?, retryAfter?)
 *     response.success(data?, message?, status?)
 *     response.error(message, status?, errors?)
 *     response.paginate(data, { page, perPage, total, path })
 *     response.download(filePath, filename?, headers?)
 *     response.streamDownload(generator, filename, options?)
 *     ...
 *
 * Note that bun-router uses *positional* args for status/headers on
 * `text`/`xml`/`html`/`view` (`text(content, status, headers)`) — NOT
 * options-object. There used to be a competing `response` defined here
 * in stacks/router with an options-object shape (`text(content, { status, headers })`).
 * It was dead code (nothing imported it) but its existence misled
 * readers and produced runtime crashes when a caller copy-pasted the
 * wrong shape (e.g. the `response.send()` ghost method). Removed —
 * use the bun-router factory directly.
 */
export {}
