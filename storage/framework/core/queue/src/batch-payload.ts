/** A terminal handler carries batch context, rather than membership in its lifecycle. */
export function batchMembershipId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const data = payload as Record<string, unknown>
  if (data._batchTerminalHandler === true) return undefined
  return typeof data._batchId === 'string' && data._batchId ? data._batchId : undefined
}

/** Reserved membership metadata always wins over the caller's payload. */
export function batchMemberPayload(payload: unknown, batchId: string, index: number) {
  return { ...(payload as Record<string, unknown> | undefined ?? {}), _batchId: batchId, _batchIndex: index, _batchTerminalHandler: false }
}

/** Keep the existing identifier available to the handler without enrolling it again. */
export function batchTerminalPayload(payload: unknown, batchId: string) {
  return { ...(payload as Record<string, unknown> | undefined ?? {}), _batchId: batchId, _batchTerminalHandler: true }
}
