import { createHash } from 'node:crypto'
import { TelephonyError } from './errors.ts'
import type { TelephonyErrorCode } from './errors.ts'
import type { WriteOptions } from './types.ts'

export type OperationOutcome = { state: 'succeeded', value: unknown } | { state: 'uncertain' } | { state: 'rejected', code: TelephonyErrorCode, status?: number, providerCode?: number }
export type OperationRecord = { fingerprint: string } & ({ state: 'pending' } | OperationOutcome)
/** claim must atomically reserve a key or return its existing record. Never expire pending/uncertain writes automatically. */
export interface OperationJournal {
  claim: (key: string, fingerprint: string) => Promise<{ acquired: boolean, record: OperationRecord }>
  settle: (key: string, outcome: OperationOutcome) => Promise<void>
}
/** Bounded, process-local test/development journal. Production needs a durable atomic implementation. */
export class MemoryOperationJournal implements OperationJournal {
  private readonly records: Map<string, OperationRecord> = new Map()
  constructor(private readonly capacity: number = 10000) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new TelephonyError('configuration', 'Journal capacity must be a positive integer.')
  }

  async claim(key: string, fingerprint: string): Promise<{ acquired: boolean, record: OperationRecord }> {
    const existing = this.records.get(key)
    if (existing) return { acquired: false, record: structuredClone(existing) }
    if (this.records.size >= this.capacity) throw new TelephonyError('capacity', 'Operation journal capacity reached.')
    const record: OperationRecord = { fingerprint, state: 'pending' }
    this.records.set(key, record)
    return { acquired: true, record: structuredClone(record) }
  }

  async settle(key: string, outcome: OperationOutcome): Promise<void> {
    const record = this.records.get(key)
    if (!record || record.state !== 'pending') throw new TelephonyError('operation_conflict', 'Only a pending operation can be settled.')
    this.records.set(key, structuredClone({ fingerprint: record.fingerprint, ...outcome }))
  }
}

/** Single-attempt writes. Twilio Calls/IncomingPhoneNumbers have no assumed idempotency header. */
export async function executeWrite<T>(journal: OperationJournal, scope: string, description: string, options: WriteOptions, run: () => Promise<T>): Promise<T> {
  const key = options?.operationKey
  if (typeof key !== 'string' || !/^[\w:.-]{1,200}$/.test(key)) throw new TelephonyError('validation', 'A stable operation key is required.')
  const fingerprint = createHash('sha256').update(description).digest('hex')
  const scopedKey = `${scope}:${key}`
  let claim: { acquired: boolean, record: OperationRecord }
  try { claim = await journal.claim(scopedKey, fingerprint) }
  catch (error) {
    if (error instanceof TelephonyError && error.code === 'capacity') throw error
    throw new TelephonyError('transport', 'Operation journal is unavailable. No provider request was sent.', { operationKey: key })
  }
  const { acquired, record } = claim
  if (record.fingerprint !== fingerprint) throw new TelephonyError('operation_conflict', 'Operation key was already used with different input.', { operationKey: key })
  if (!acquired) {
    if (record.state === 'succeeded') return structuredClone(record.value) as T
    if (record.state === 'rejected') throw new TelephonyError(record.code, 'Provider rejected this operation.', { status: record.status, providerCode: record.providerCode, operationKey: key })
    throw new TelephonyError(record.state === 'pending' ? 'operation_pending' : 'write_uncertain', 'Reconcile the existing operation before attempting another write.', { operationKey: key })
  }
  let value: T
  try { value = await run() }
  catch (error) {
    const rejected = error instanceof TelephonyError && ['authentication', 'not_found', 'rate_limited', 'rejected', 'validation'].includes(error.code)
    const outcome: OperationOutcome = rejected
      ? { state: 'rejected', code: error.code, status: error.details.status, providerCode: error.details.providerCode }
      : { state: 'uncertain' }
    try { await journal.settle(scopedKey, outcome) }
    catch { throw new TelephonyError('write_uncertain', 'Write outcome could not be recorded. Reconcile before retrying.', { operationKey: key }) }
    if (rejected) throw error
    throw new TelephonyError('write_uncertain', 'Provider write may have completed. Reconcile before retrying.', { operationKey: key })
  }
  try { await journal.settle(scopedKey, { state: 'succeeded', value }) }
  catch { throw new TelephonyError('write_uncertain', 'Provider write completed but its result could not be recorded. Reconcile before retrying.', { operationKey: key }) }
  return value
}
