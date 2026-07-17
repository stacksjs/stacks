export type PrimitiveModule = readonly [module: string, names: readonly string[]]

/**
 * Runtime values Stacks makes available as server-side globals.
 *
 * This list is shared by runtime injection and the auto-import declaration
 * generator so globals such as `db` have the same behavior in Bun and in the
 * TypeScript language service.
 */
export const primitiveModules = [
  ['@stacksjs/path', ['path']],
  ['@stacksjs/error-handling', ['HttpError', 'handleError']],
  ['@stacksjs/logging', ['log']],
  ['@stacksjs/config', ['config']],
  ['@stacksjs/validation', ['schema']],
  ['@stacksjs/router', ['response', 'request', 'route', 'Middleware', 'url']],
  ['@stacksjs/storage', ['storage', 'fs']],
  ['@stacksjs/orm', ['defineModel', 'toAttrs']],
  ['@stacksjs/database', ['db', 'sql']],
  ['@stacksjs/email', ['mail', 'template']],
  ['@stacksjs/queue', ['Job']],
  ['@stacksjs/scheduler', ['schedule']],
  ['@stacksjs/actions', ['Action']],
  ['@stacksjs/auth', ['Auth', 'register', 'sessionCheck']],
  ['@stacksjs/events', ['dispatch', 'listen', 'emitter']],
  ['@stacksjs/feature-flags', ['Feature']],
  ['@stacksjs/security', ['makeHash', 'verifyHash']],
  ['@stacksjs/collections', ['collect']],
  ['@stacksjs/cli', ['quotes']],
  ['@stacksjs/notifications', ['notify', 'useNotification', 'useEmail', 'useSMS', 'useChat', 'useDatabase']],
  ['@stacksjs/realtime', ['emit', 'emitToUser', 'emitToUsers', 'createChannel', 'dispatchBroadcast']],
  ['@stacksjs/i18n', ['I18n', 't', 'tc', 'te', 'setLocale', 'getLocale']],
  ['@stacksjs/stx', ['state', 'derived', 'effect']],
  ['@stacksjs/browser', ['useDark', 'usePreferredDark', 'useToggle', 'useStorage']],
] as const satisfies readonly PrimitiveModule[]

export function primitiveAutoImportEntries() {
  return primitiveModules.flatMap(([from, names]) =>
    names.map(name => ({ from, name, as: name })),
  )
}
