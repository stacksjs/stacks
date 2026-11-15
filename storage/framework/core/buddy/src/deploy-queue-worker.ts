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
/** A command that reads the queue: `buddy queue:work`, or ts-cloud's worker entry. */
const QUEUE_WORKER_COMMAND = /queue[:-]work|queue-worker/

export function missingQueueWorkerProblem(sites: Record<string, any> | undefined, queueDriver: string | undefined): string | undefined {
  const all = Object.values(sites ?? {}).filter(Boolean)
  const served = all.filter(site => site.start || site.port)
  // Nothing of this app's runs on a server: there is nowhere to run a worker.
  if (served.length === 0)
    return undefined

  // An app that serves none of the framework's routes sends none of its mail,
  // which is what this warning is about. One that dispatches jobs of its own
  // from there still needs a worker, and is not something this can see.
  if (served.every(site => site.env?.STACKS_DEFAULT_ROUTES === 'none'))
    return undefined

  // A worker is declared as `queues`, as a daemon, or as a site of its own
  // whose whole job is to run the queue.
  const worked = all.some(site =>
    (Array.isArray(site.queues) && site.queues.length > 0)
    || QUEUE_WORKER_COMMAND.test(String(site.start ?? ''))
    || (Array.isArray(site.daemons) && site.daemons.some((daemon: any) => QUEUE_WORKER_COMMAND.test(String(daemon?.command ?? '')))))
  if (worked)
    return undefined

  // Production refuses `sync`, so a local `.env` that says it is not what runs.
  const driver = queueDriver === 'redis' ? 'redis' : 'database'
  return `No site declares a queue worker, and in production jobs are queued (to ${driver === 'redis' ? 'redis' : 'the database'}): anything the app dispatches, password reset and other framework emails included, will be accepted and never run. `
    + `Add \`queues: [{ connection: '${driver}', queue: 'emails,default' }]\` to a site in config/cloud.ts${driver === 'database' ? ', and `buddy queue:table` after `migrate` in its preStart.' : '.'}`
}
