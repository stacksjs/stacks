export interface CloseableDatabaseConnection {
  close: () => Promise<void> | void
}

/**
 * Drain every distinct database client before reporting shutdown complete.
 *
 * Promise.allSettled is intentional: one failed pool must not prevent the
 * remaining primary or replica pools from releasing their sockets.
 */
export async function closeDatabaseConnections(connections: Iterable<CloseableDatabaseConnection>): Promise<void> {
  const results = await Promise.allSettled(
    [...new Set(connections)].map(connection => connection.close()),
  )
  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map(result => result.reason)

  if (errors.length === 1)
    throw errors[0]
  if (errors.length > 1)
    throw new AggregateError(errors, 'Failed to close database connections')
}
