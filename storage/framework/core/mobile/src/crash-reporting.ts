/**
 * Crash and error reporting for Stacks mobile apps (bughq).
 *
 * The native shell already reports what JavaScript cannot see: crashes,
 * hangs, ANRs, and uncaught errors in native screens and the app script
 * (Craft's CraftCrashReporter, turned on by `crashReporting` in
 * config/mobile.ts). This is the JavaScript half:
 *
 *  - `start()` runs `@bughq/sdk` in the pages the app shows (the web views),
 *    with a transport that hands each event to the native reporter. The event
 *    then shares the reporter's on-disk outbox (sent when the phone is online),
 *    its session (for crash-free sessions) and the device's own context.
 *  - `setUser(id)` names the signed-in user for every later event, native ones
 *    included. An id only: never an email, a name or health data.
 *  - Breadcrumbs for screen changes and failed requests are mirrored to the
 *    native reporter too, so a crash report carries the trail that led to it.
 *
 * Off the app, `start()` does nothing unless it is given a key, so the same
 * layout can render on the website without reporting there by accident.
 */
import type { Breadcrumb, BugHQConfig } from '@bughq/sdk'
import { BugHQClient } from '@bughq/sdk'
import { crashReporter } from 'craft-native/mobile'
import { hasNativeMobileHost } from './bridge'

export interface CrashReportingOptions extends Omit<BugHQConfig, 'transport'> {}

let client: BugHQClient | null = null

/** Whether a breadcrumb is worth keeping: a failed request, or anything not a request. */
export function keepBreadcrumb(crumb: Breadcrumb): boolean {
  if (crumb.type !== 'http')
    return true
  const data = crumb.data ?? {}
  const status = typeof data.status === 'number' ? data.status : 0
  return data.error === true || status >= 400 || status === 0
}

/** The native reporter, when this page runs in an app built with it. */
function nativeReporter(): boolean {
  return crashReporter.isAvailable()
}

/**
 * The transport inside the app. Without the native reporter (an app built
 * without crash reporting, or a bridge that is gone) the event goes over HTTP
 * when the page was given a key of its own, and is dropped when it was not:
 * there is nowhere to send it.
 */
function handOver(hasOwnKey: boolean): NonNullable<BugHQConfig['transport']> {
  return async (event) => {
    if (!nativeReporter())
      return !hasOwnKey
    return crashReporter.capture(event as unknown as Record<string, unknown>)
  }
}

export const crashReporting = {
  /**
   * Start reporting this page's errors. Inside the app no key is needed: the
   * native reporter holds it. Returns the client, or null when there is
   * nothing to report to. Calling it again returns the same client.
   */
  start(options: CrashReportingOptions = {}): BugHQClient | null {
    if (client)
      return client
    const inApp = hasNativeMobileHost() || nativeReporter()
    if (!inApp && !options.key && !options.dsn)
      return null
    const userBeforeBreadcrumb = options.beforeBreadcrumb
    client = new BugHQClient({
      framework: 'stacks-mobile',
      sdkName: 'bughq.stacks.mobile',
      // Screen changes and requests; requests are filtered to failures below.
      autoInstrument: { navigation: true, fetch: true, xhr: true },
      ...options,
      // The native session pings stand in for the heartbeat inside the app.
      heartbeat: inApp ? false : options.heartbeat,
      transport: inApp ? handOver(Boolean(options.key || options.dsn)) : undefined,
      beforeBreadcrumb(crumb) {
        if (!keepBreadcrumb(crumb))
          return null
        const result = userBeforeBreadcrumb ? userBeforeBreadcrumb(crumb) : crumb
        if (result === null)
          return null
        const kept = result || crumb
        if (inApp)
          void crashReporter.addBreadcrumb(kept as Record<string, any>)
        return kept
      },
    })
    return client
  },

  /** The app's own user id for every later event, or null on sign-out. */
  async setUser(id: string | number | null | undefined): Promise<void> {
    const value = id === null || id === undefined || id === '' ? null : String(id)
    client?.setUser(value === null ? null : { id: value })
    await crashReporter.setUser(value)
  },

  /** Report an error your code caught (it is not captured otherwise). */
  capture(error: unknown, extra?: Record<string, unknown>): void {
    client?.captureException(error, extra)
  },

  /** Add to the trail a later error or crash report carries. */
  addBreadcrumb(crumb: Breadcrumb): void {
    if (client)
      client.addBreadcrumb(crumb)
    else
      void crashReporter.addBreadcrumb(crumb as Record<string, any>)
  },

  /** Send what is queued, natively and in this page. */
  async flush(): Promise<void> {
    await Promise.all([client?.flush(), crashReporter.flush()])
  },

  client(): BugHQClient | null {
    return client
  },

  /** Remove this page's handlers (tests, or a page that turns reporting off). */
  stop(): void {
    client?.close()
    client = null
  },
}
