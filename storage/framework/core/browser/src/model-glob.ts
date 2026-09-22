import type { BrowserModelDefinition } from './model-loader'

/**
 * The `import.meta.glob` half of browser model loading, kept in its own module
 * on purpose.
 *
 * `import.meta` is a SyntaxError outside a module, and it is a PARSE error —
 * it cannot be guarded, defaulted or caught, because nothing in the file runs.
 * model-loader.ts used to read it behind `typeof import.meta.glob ===
 * 'function'`, which looks like a runtime check and is not one: the file fails
 * before that expression is ever evaluated.
 *
 * That mattered because this package is transpiled file-by-file rather than
 * bundled, so the token travels verbatim into an application's client bundle.
 * Any page whose bundle is emitted as a classic script then fails to parse —
 * taking down every feature on it, not just models. It surfaced as a public
 * share page stuck on a spinner with one SyntaxError in the console.
 *
 * Isolating it here means the default path in model-loader.ts cannot carry the
 * token at all, while Vite consumers keep the build-time glob by importing
 * this module and handing the result over:
 *
 *   import { modelModules } from '@stacksjs/browser/model-glob'
 *   import { loadBrowserModels } from '@stacksjs/browser'
 *
 *   loadBrowserModels(modelModules)
 *
 * Importing this module outside a module context is the one thing that will
 * still throw, which is correct: that is precisely where the glob cannot work.
 */
export const modelModules: Record<string, { default: BrowserModelDefinition }>
  = typeof (import.meta as { glob?: unknown }).glob === 'function'
    ? (import.meta as unknown as { glob: (pattern: string, opts?: { eager?: boolean }) => Record<string, { default: BrowserModelDefinition }> }).glob('~/app/Models/*.ts', { eager: true })
    : {}
