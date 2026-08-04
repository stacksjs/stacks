import process from 'node:process'

/**
 * Exit when whatever spawned this dev server goes away.
 *
 * `./buddy dev` starts long-running children (the API server, the views
 * server, docs) and kills them from a SIGINT/SIGTERM handler. That handler
 * cannot run when the parent is SIGKILLed, when its terminal is closed, or
 * when a supervising tool tears the process down without a grace period,
 * and in every one of those cases the child survives, keeps its port, and
 * the next `./buddy dev` fails with EADDRINUSE.
 *
 * Left alone these accumulate: a machine that has restarted the dev server
 * a few dozen times over a week carries a few dozen orphans, each one
 * holding a port and a file watcher, and the API server has not started
 * successfully since the first orphan claimed 3008.
 *
 * A child cannot be notified of its parent's death portably, but it can
 * observe the consequence: the OS reparents orphans (to launchd on macOS,
 * to init or the nearest subreaper on Linux), so a changed ppid means the
 * parent is gone. Polling that is cheap and needs no cooperation from
 * whoever did the killing.
 *
 * The signal handlers alongside it cover the ordinary case, where the exit
 * is graceful and should not wait for the next poll.
 */

const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const

export interface ExitWithParentOptions {
  /** How often to check that the parent is still there. */
  intervalMs?: number
  /** Best-effort teardown, run before the process exits. */
  onExit?: () => void
}

/** Returns a function that cancels the watch, for tests and for reuse. */
export function exitWithParent(options: ExitWithParentOptions = {}): () => void {
  const { intervalMs = 2000, onExit } = options
  const parentPid = process.ppid

  let stopped = false

  const stop = (): void => {
    if (stopped)
      return
    stopped = true
    clearInterval(timer)
    for (const signal of SIGNALS) process.off(signal, handleSignal)
  }

  const quit = (): void => {
    stop()
    try {
      onExit?.()
    }
    catch { /* teardown is best-effort; never block the exit on it */ }
    process.exit(0)
  }

  const handleSignal = (): void => quit()

  // ppid 1 is belt and braces: the comparison already catches reparenting
  // wherever it points, but the explicit check costs nothing and reads
  // plainly to whoever finds this next.
  const timer = setInterval(() => {
    if (process.ppid !== parentPid || process.ppid === 1)
      quit()
  }, intervalMs)

  // Never hold the event loop open. A dev server stays alive on its own
  // listening socket; this watchdog must not be the reason a process that
  // is otherwise finished keeps running.
  timer.unref?.()

  for (const signal of SIGNALS) process.on(signal, handleSignal)

  return stop
}
