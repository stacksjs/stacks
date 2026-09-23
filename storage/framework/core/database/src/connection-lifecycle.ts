export interface CloseableDatabaseConnection {
  close: () => Promise<void> | void
}

export type PendingDatabaseConnectionClosures = Set<Promise<void>>

/**
 * Drain every distinct database client before reporting shutdown complete.
 *
 * Promise.allSettled is intentional: one failed pool must not prevent the
 * remaining primary or replica pools from releasing their sockets.
 */
export async function closeDatabaseConnections(connections: Iterable<CloseableDatabaseConnection>): Promise<void> {
  const results = await Promise.allSettled(
    [...new Set(connections)].map(async connection => connection.close()),
  )
  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map(result => result.reason)

  if (errors.length === 1)
    throw errors[0]
  if (errors.length > 1)
    throw new AggregateError(errors, 'Failed to close database connections')
}

/**
 * Start draining connections that reset has detached, while retaining their
 * closure promise for a later process shutdown.
 */
export function retireDatabaseConnections(
  pending: PendingDatabaseConnectionClosures,
  connections: Iterable<CloseableDatabaseConnection>,
  onError: (error: unknown) => void,
): void {
  const closing = closeDatabaseConnections(connections)
  pending.add(closing)
  void closing.then(
    () => pending.delete(closing),
    (error) => {
      pending.delete(closing)
      onError(error)
    },
  )
}

/** Drain active connections together with every reset closure still pending. */
export function closeDatabaseConnectionsAndPending(
  connections: Iterable<CloseableDatabaseConnection>,
  pending: PendingDatabaseConnectionClosures,
): Promise<void> {
  return closeDatabaseConnections([
    ...connections,
    ...[...pending].map(closing => ({ close: () => closing })),
  ])
}
