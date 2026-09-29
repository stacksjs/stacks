export interface AuthPruneFlags {
  expired?: boolean
  revoked?: boolean
}

/** Preserve CAC's negated booleans when forwarding auth:prune to its action. */
export function authPruneActionOptions<T extends AuthPruneFlags>(options: T): T & Record<'no-expired' | 'no-revoked', boolean> {
  return {
    ...options,
    'no-expired': options.expired === false,
    'no-revoked': options.revoked === false,
  }
}
