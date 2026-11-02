/**
 * Content scripts as standalone `WKUserScript` sources.
 *
 * A WebKit app has no `chrome.*`. A page-world script never had it either, so
 * it ships as bundled. An isolated-world script that calls `chrome.runtime` or
 * `chrome.storage` is wrapped with a small bridge that turns those calls into
 * messages to a `window.webkit.messageHandlers.<name>` handler the host app
 * installs. Nothing global is defined for the page: the bridge is passed into
 * the bundle as its `chrome` and `browser` bindings.
 *
 * The message contract (version 1), page to app, through
 * `webkit.messageHandlers[name].postMessage(body)` (register the handler with
 * `WKScriptMessageHandlerWithReply` so `postMessage` resolves to the reply):
 *
 * | `body.api`            | `body.payload`                          | reply                               |
 * |-----------------------|-----------------------------------------|-------------------------------------|
 * | `runtime.sendMessage` | `{ message }`                           | the response, or null               |
 * | `storage.get`         | `{ area, keys: null \| string \| string[] \| object }` | an object of the stored items |
 * | `storage.set`         | `{ area, items }`                       | null                                |
 * | `storage.remove`      | `{ area, keys: string[] }`              | null                                |
 * | `storage.clear`       | `{ area }`                              | null                                |
 *
 * Every body also carries `v: 1`. `area` is `local`, `sync` or `session`. A
 * rejected reply (an error from the handler) rejects the call, and callback
 * callers see it as `chrome.runtime.lastError`.
 *
 * App to page, by evaluating JavaScript in the script's content world
 * (`callAsyncJavaScript` awaits the returned promise):
 *
 * ```js
 * __stacksWebKit[name].dispatch({ type: 'runtime.message', message, sender })  // resolves to the first listener's response
 * __stacksWebKit[name].dispatch({ type: 'storage.changed', area, changes })     // changes: { key: { oldValue, newValue } }
 * ```
 */

/** A content script ready for `WKUserScript`. */
export interface WebKitUserScript {
  id: string
  /** Extension match patterns (`*://*.example.com/*`), for the app to test URLs against. */
  matches: string[]
  excludeMatches: string[]
  /** `document_idle` has no WebKit counterpart and runs at `document-end`. */
  runAt: 'document-start' | 'document-end'
  /** False means `forMainFrameOnly`. */
  allFrames: boolean
  matchAboutBlank: boolean
  /** `page` is `WKContentWorld.page`; `isolated` is a content world of the app's own. */
  world: 'page' | 'isolated'
  source: string
}

/** What a wrapped script calls, and whether the bridge covers it. */
export interface WebKitScriptApis {
  /** `chrome.<namespace>.<member>` uses found in the bundle, as `namespace.member`. */
  apis: string[]
  /** Uses the bridge does not provide: these calls fail at runtime. */
  unsupportedApis: string[]
  /** Whether the bridge was prepended. */
  bridged: boolean
}

/** The `chrome.*` surface the bridge provides. */
export const WEBKIT_BRIDGE_APIS: readonly string[] = [
  'runtime.sendMessage',
  'runtime.onMessage',
  'runtime.id',
  'runtime.lastError',
  'storage.local',
  'storage.sync',
  'storage.session',
  'storage.onChanged',
]

/** The version of the message contract the bridge speaks. */
export const WEBKIT_BRIDGE_VERSION = 1

const apiUse = /(?<![\w$.])(?:chrome|browser)\s*(?:\?\.|\.)\s*([A-Za-z]+)\s*(?:\?\.|\.)\s*([A-Za-z]+)/g

/** Every `chrome.<namespace>.<member>` (or `browser.…`) a bundle touches. */
export function chromeApisUsed(code: string): string[] {
  const found = new Set<string>()
  for (const match of code.matchAll(apiUse))
    found.add(`${match[1]}.${match[2]}`)
  return [...found].sort()
}

/**
 * The bridge as a JavaScript expression evaluating to a `chrome`-shaped
 * object. One instance per handler per content world, shared by every script
 * that world runs, so listeners registered by one script see every event.
 */
export function webkitBridgeSource(handler: string): string {
  return `(function (name) {
  var root = typeof globalThis !== 'undefined' ? globalThis : window
  var registry = root.__stacksWebKit || (root.__stacksWebKit = {})
  if (registry[name]) return registry[name].chrome
  var runtime = { id: name, lastError: undefined }
  function post(api, payload) {
    var handlers = root.webkit && root.webkit.messageHandlers
    var target = handlers && handlers[name]
    if (!target) return Promise.reject(new Error('Stacks WebKit bridge: no "' + name + '" message handler is installed'))
    try { return Promise.resolve(target.postMessage({ v: ${WEBKIT_BRIDGE_VERSION}, api: api, payload: payload })) }
    catch (error) { return Promise.reject(error) }
  }
  function settle(promise, callback) {
    if (typeof callback !== 'function') return promise
    promise.then(function (value) { callback(value) }, function (error) {
      runtime.lastError = { message: String((error && error.message) || error) }
      try { callback(undefined) } finally { runtime.lastError = undefined }
    })
  }
  function nothing() { return undefined }
  function event(listeners) {
    return {
      addListener: function (fn) { if (listeners.indexOf(fn) < 0) listeners.push(fn) },
      removeListener: function (fn) { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1) },
      hasListener: function (fn) { return listeners.indexOf(fn) >= 0 },
      hasListeners: function () { return listeners.length > 0 }
    }
  }
  var messageListeners = []
  var changeListeners = []
  var areaListeners = { local: [], sync: [], session: [] }
  function area(areaName) {
    return {
      get: function (keys, callback) {
        if (typeof keys === 'function') { callback = keys; keys = undefined }
        var request = keys === undefined ? null : keys
        return settle(post('storage.get', { area: areaName, keys: request }).then(function (items) {
          items = items || {}
          if (!request || typeof request !== 'object' || Array.isArray(request)) return items
          var merged = {}
          for (var key in request) merged[key] = Object.prototype.hasOwnProperty.call(items, key) ? items[key] : request[key]
          return merged
        }), callback)
      },
      set: function (items, callback) { return settle(post('storage.set', { area: areaName, items: items }).then(nothing), callback) },
      remove: function (keys, callback) { return settle(post('storage.remove', { area: areaName, keys: typeof keys === 'string' ? [keys] : keys }).then(nothing), callback) },
      clear: function (callback) { return settle(post('storage.clear', { area: areaName }).then(nothing), callback) },
      onChanged: event(areaListeners[areaName])
    }
  }
  runtime.sendMessage = function () {
    var args = Array.prototype.slice.call(arguments)
    var callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined
    var message = typeof args[0] === 'string' && args.length > 1 ? args[1] : args[0]
    return settle(post('runtime.sendMessage', { message: message }), callback)
  }
  runtime.onMessage = event(messageListeners)
  var chrome = { runtime: runtime, storage: { local: area('local'), sync: area('sync'), session: area('session'), onChanged: event(changeListeners) } }
  function each(listeners, args) {
    listeners.slice().forEach(function (fn) { try { fn.apply(null, args) } catch (error) { console.error(error) } })
  }
  function dispatch(event) {
    if (!event || typeof event !== 'object') return undefined
    if (event.type === 'storage.changed') {
      var areaName = event.area || 'local'
      each(changeListeners, [event.changes || {}, areaName])
      each(areaListeners[areaName] || [], [event.changes || {}])
      return undefined
    }
    if (event.type !== 'runtime.message') return undefined
    return new Promise(function (resolve) {
      var waiting = 0
      var done = false
      function respond(value) { if (!done) { done = true; resolve(value) } }
      messageListeners.slice().forEach(function (fn) {
        var result
        try { result = fn(event.message, event.sender || { id: name }, respond) }
        catch (error) { console.error(error); return }
        if (result === true) waiting++
        else if (result && typeof result.then === 'function') { waiting++; result.then(respond, function () { respond(undefined) }) }
      })
      if (!waiting) respond(undefined)
    })
  }
  registry[name] = { chrome: chrome, dispatch: dispatch, version: ${WEBKIT_BRIDGE_VERSION} }
  return chrome
})(${JSON.stringify(handler)})`
}

/**
 * Prepare one bundled content script for WebKit. Page-world scripts ship as
 * they are. Isolated-world scripts that touch `chrome.*` / `browser.*` get the
 * bridge as those bindings.
 */
export function wrapForWebKit(code: string, options: { handler: string, world: 'page' | 'isolated' }): WebKitScriptApis & { source: string } {
  const apis = chromeApisUsed(code)
  const unsupportedApis = apis.filter(api => !WEBKIT_BRIDGE_APIS.includes(api))
  if (options.world === 'page' || !apis.length)
    return { source: code, apis, unsupportedApis: options.world === 'page' ? apis : [], bridged: false }

  const bridge = webkitBridgeSource(options.handler)
  const source = ['(function (chrome) {', 'var browser = chrome;', code.trim(), `})(${bridge});`, ''].join('\n')
  return { source, apis, unsupportedApis, bridged: true }
}
