/**
 * @stacksjs/browser-extension
 *
 * Build MV3 browser extensions (Chrome, Firefox, Safari) from a single
 * `ExtensionConfig` — manifest generation, content/background script bundling,
 * stx pages, declarativeNetRequest rulesets, and store-ready packaging — with
 * none of the per-project boilerplate. Safari additionally gets the container
 * app scaffold, appex resource sync, and xcodebuild pipeline.
 */
export * from './build'
export * from './app-store-connect'
export * from './app-store-submission'
export * from './chrome-web-store'
export * from './config'
export * from './firefox-addons'
export * from './manifest'
export * from './package'
export * from './safari'
export * from './scaffold'
export * from './sanitize'
export * from './types'
