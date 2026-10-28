import { runShutdownHooks } from '@stacksjs/router'

export interface ApiShutdownOptions {
  /** The longest the process may take to stop; it exits then whatever is still running. */
  graceMs: number
  exit: (code: number) => void
  /** What else has to stop with the server. Defaults to the router's shutdown hooks. */
  hooks?: () => Promise<void>
}

/**
 * Stop the production API server (stacksjs/stacks#3034).
 *
 * The zero-downtime cutover sends the old release SIGTERM. It stops accepting
 * connections and lets in-flight requests finish, and alongside that runs the
 * shutdown hooks: what the process holds that would otherwise outlive it or
 * end unrecorded, such as open terminal sessions. Both share the grace window,
 * and the process exits when both are done or when it runs out, so a stuck
 * keep-alive or a hook that hangs cannot ride into systemd's SIGKILL.
 */
export async function shutDownApiServer(server: { stop: () => unknown } | undefined, options: ApiShutdownOptions): Promise<void> {
  let exited = false
  const exit = (): void => {
    if (exited)
      return
    exited = true
    options.exit(0)
  }

  const deadline = setTimeout(exit, options.graceMs)
  deadline.unref?.()

  await Promise.allSettled([
    (options.hooks ?? runShutdownHooks)(),
    Promise.resolve().then(() => server?.stop()),
  ])
  clearTimeout(deadline)
  exit()
}
