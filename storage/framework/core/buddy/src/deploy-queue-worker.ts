/**
 * Why this deploy leaves queued jobs with nothing to run them, phrased as the
 * fix. Returns undefined when a worker is declared or jobs do not queue.
 *
 * In production the framework queues every dispatched job, to the database
 * unless QUEUE_DRIVER says redis, and it refuses `sync`. The framework's own
 * actions dispatch jobs in every app (a password reset email is one), so an
 * app that declares no worker has mail that is accepted and never sent. That
 * fails silently by design at the call site, which is why it is said here.
 */
export function missingQueueWorkerProblem(sites: Record<string, any> | undefined, queueDriver: string | undefined): string | undefined {
  const all = Object.values(sites ?? {}).filter(Boolean)
  // Nothing of this app's runs on a server: there is nowhere to run a worker.
  if (!all.some(site => site.start || site.port))
    return undefined

  const worked = all.some(site =>
    (Array.isArray(site.queues) && site.queues.length > 0)
    || (Array.isArray(site.daemons) && site.daemons.some((daemon: any) => /queue[:-]work|queue-worker/.test(String(daemon?.command ?? '')))))
  if (worked)
    return undefined

  const driver = queueDriver || 'database'
  return `No site declares a queue worker, and in production jobs are queued (QUEUE_DRIVER=${driver}): anything the app dispatches, password reset and other framework emails included, will be accepted and never run. `
    + `Add \`queues: [{ connection: '${driver}', queue: 'emails,default' }]\` to a site in config/cloud.ts${driver === 'database' ? ', and `buddy queue:table` after `migrate` in its preStart.' : '.'}`
}
