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
  /**
   * Keep running when the parent goes away. Defaults to `STACKS_DEV_DETACH=1`,
   * which `buddy dev --detach` sets for itself and every server it starts, so
   * `nohup ./buddy dev --frontend --detach &` stays up after its shell exits.
   * The signal handlers stay: Ctrl-C and `kill` still stop it.
   */
  detach?: boolean
  /** Best-effort teardown, run before the process exits. */
  onExit?: () => void
}

/** Returns a function that cancels the watch, for tests and for reuse. */
export function exitWithParent(options: ExitWithParentOptions = {}): () => void {
  const { intervalMs = 2000, onExit } = options
  const detach = options.detach ?? process.env.STACKS_DEV_DETACH === '1'
  const parentPid = process.ppid

  let stopped = false
  let timer: ReturnType<typeof setInterval> | undefined

  const stop = (): void => {
    if (stopped)
      return
    stopped = true
    if (timer)
      clearInterval(timer)
    for (const signal of SIGNALS) process.off(signal, handleSignal)
  }

  const quit = (reason: string): void => {
    stop()
    // Say why. Both ways out of this watchdog used to write nothing, so an
    // orphaned dev process and a crashed one left identical logs: the last
    // line was whatever startup happened to print, the port stopped
    // answering, and the status was 0 either way (stacksjs/stacks#3066).
    //
    // `console.log` rather than the async logger, for the reason measured in
    // stacksjs/stacks#3065: `log.info` reaches the console only after it
    // awaits its logger, and the `process.exit` below outruns that
    // continuation, so the line is lost. Keeping to `node:process` as this
    // module's only import also keeps it cheap for the three dev entry
    // scripts that load it, one of which pulls in no logger at all.
    console.log(`  stacks ${reason} - stopping this dev process`)
    try {
      onExit?.()
    }
    catch { /* teardown is best-effort; never block the exit on it */ }
    process.exit(0)
  }

  const handleSignal = (signal: NodeJS.Signals): void => quit(`received ${signal}`)

  // Detached: no polling, so nothing ends the process but its own signals.
  if (detach) {
    for (const signal of SIGNALS) process.on(signal, handleSignal)
    return stop
  }

  // ppid 1 is belt and braces: the comparison already catches reparenting
  // wherever it points, but the explicit check costs nothing and reads
  // plainly to whoever finds this next.
  timer = setInterval(() => {
    if (process.ppid === parentPid && process.ppid !== 1)
      return

    // Name the cause. No signal is involved on this path at all, so a reader
    // who finds only "stopping" goes looking for one that was never sent;
    // naming the parent says plainly that the cause was outside this process.
    //
    // A process that was already orphaned when it started never had a parent
    // to lose, and telling that reader "pid 1 went away" points them at
    // something that was never there. `( nohup buddy dev … & )` lands here,
    // because the subshell is gone before the dev process even starts.
    quit(parentPid === 1
      ? 'started with no parent to watch (ppid 1; pass --detach to `buddy dev` to run it in the background)'
      : `saw the parent process (pid ${parentPid}) go away`)
  }, intervalMs)

  // Never hold the event loop open. A dev server stays alive on its own
  // listening socket; this watchdog must not be the reason a process that
  // is otherwise finished keeps running.
  timer.unref?.()

  for (const signal of SIGNALS) process.on(signal, handleSignal)

  return stop
}
