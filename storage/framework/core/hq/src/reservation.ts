export interface UsageQuotaSnapshot {
  meter: string
  used: number
  limit: number | null
}

export interface UsageQuotaStore {
  read: (meter: string) => Promise<UsageQuotaSnapshot | null>
  compareAndSet: (snapshot: UsageQuotaSnapshot, nextUsed: number) => Promise<boolean>
}

export interface UsageReservation {
  meter: string
  quantity: number
  previousUsed: number
  used: number
  limit: number | null
}

export type UsageQuotaErrorCode = 'unavailable' | 'invalid' | 'exceeded' | 'contention'

export class UsageQuotaError extends Error {
  constructor(public readonly code: UsageQuotaErrorCode, meter: string) {
    const messages: Record<UsageQuotaErrorCode, string> = {
      unavailable: `Usage meter unavailable for ${meter}`,
      invalid: `Usage meter state is invalid for ${meter}`,
      exceeded: `Usage limit exceeded for ${meter}`,
      contention: `Usage reservation contention for ${meter}`,
    }
    super(messages[code])
    this.name = 'UsageQuotaError'
  }
}

function validQuantity(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function validSnapshot(snapshot: UsageQuotaSnapshot, meter: string): boolean {
  return snapshot.meter === meter
    && Number.isFinite(snapshot.used)
    && snapshot.used >= 0
    && (snapshot.limit === null || (Number.isFinite(snapshot.limit) && snapshot.limit >= 0))
}

function attempts(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 1
}

export async function reserveUsage(
  store: UsageQuotaStore,
  meter: string,
  quantity = 1,
  maxAttempts = 5,
): Promise<UsageReservation> {
  if (!meter || !validQuantity(quantity))
    throw new UsageQuotaError('invalid', meter || 'unknown')

  for (let attempt = 0; attempt < attempts(maxAttempts); attempt++) {
    const snapshot = await store.read(meter)
    if (!snapshot)
      throw new UsageQuotaError('unavailable', meter)
    if (!validSnapshot(snapshot, meter))
      throw new UsageQuotaError('invalid', meter)

    const nextUsed = snapshot.used + quantity
    if (snapshot.limit !== null && nextUsed > snapshot.limit)
      throw new UsageQuotaError('exceeded', meter)

    if (await store.compareAndSet(snapshot, nextUsed)) {
      return {
        meter,
        quantity,
        previousUsed: snapshot.used,
        used: nextUsed,
        limit: snapshot.limit,
      }
    }
  }

  throw new UsageQuotaError('contention', meter)
}

export async function releaseUsage(
  store: UsageQuotaStore,
  reservation: UsageReservation,
  maxAttempts = 5,
): Promise<void> {
  if (!reservation.meter || !validQuantity(reservation.quantity))
    throw new UsageQuotaError('invalid', reservation.meter || 'unknown')

  for (let attempt = 0; attempt < attempts(maxAttempts); attempt++) {
    const snapshot = await store.read(reservation.meter)
    if (!snapshot)
      throw new UsageQuotaError('unavailable', reservation.meter)
    if (!validSnapshot(snapshot, reservation.meter) || snapshot.used < reservation.quantity)
      throw new UsageQuotaError('invalid', reservation.meter)

    if (await store.compareAndSet(snapshot, snapshot.used - reservation.quantity))
      return
  }

  throw new UsageQuotaError('contention', reservation.meter)
}
