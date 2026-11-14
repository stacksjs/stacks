import type { MemoryDurableReplayOptions, DurableReplayStore, PreparedAppend, ReplayState } from './durable-replay-contract'
import { channelName, DurableReplayError, prepareAppend, readInput, replayOptions, replayPage } from './durable-replay-contract'
export type { DurableReplayAppend, DurableReplayCursor, DurableReplayMessage, DurableReplayOptions, DurableReplayPage, DurableReplayRead, DurableReplayStore, MemoryDurableReplayOptions } from './durable-replay-contract'
export { DurableReplayError } from './durable-replay-contract'

/** Deterministic in-memory fake for the durable contract. Existing replay buffer is unchanged. */
export function createMemoryDurableReplayStore(options: MemoryDurableReplayOptions = {}): DurableReplayStore {
  const configuration = replayOptions(options, options.incarnation)
  const channels = new Map<string, ReplayState & { entries: (PreparedAppend & { seq: number, ts: number })[] }>()
  function state(channel: string) {
    channelName(channel)
    let value = channels.get(channel)
    if (!value) { value = { incarnation: configuration.newIncarnation(), highWaterMark: 0, prunedThrough: 0, lastRecordedAt: 0, entries: [] }; channels.set(channel, value) }
    const now = Math.max(configuration.now(), value.lastRecordedAt)
    value.prunedThrough = Math.max(value.prunedThrough, value.highWaterMark - configuration.policy.maxEvents, ...value.entries.filter(entry => entry.ts <= now - configuration.policy.ttlMs).map(entry => entry.seq))
    value.entries = value.entries.filter(entry => entry.seq > value!.prunedThrough)
    return value
  }
  return {
    async append(input) {
      const prepared = prepareAppend(input, configuration.policy), value = state(prepared.channel)
      const prior = value.entries.find(entry => entry.operationKey === prepared.operationKey)
      if (prior && prior.fingerprint !== prepared.fingerprint) throw new DurableReplayError('replay_idempotency_conflict', 'Operation ID was used with different event data')
      if (value.highWaterMark === Number.MAX_SAFE_INTEGER && !prior) throw new DurableReplayError('replay_sequence_exhausted', 'Channel sequence is exhausted')
      const entry = prior ?? { ...prepared, seq: value.highWaterMark + 1, ts: Math.max(configuration.now(), value.lastRecordedAt) }
      if (!prior) { value.highWaterMark = entry.seq; value.lastRecordedAt = entry.ts; value.entries.push(entry); state(prepared.channel) }
      return { message: { seq: entry.seq, ts: entry.ts, event: entry.event, data: JSON.parse(entry.payload) }, cursor: { incarnation: value.incarnation, seq: entry.seq }, duplicate: !!prior }
    },
    async replay(input) {
      const read = readInput(input), value = state(input.channel)
      const messages = value.entries.filter(entry => entry.seq > (read.after?.seq ?? 0)).slice(0, read.limit).map(entry => ({ seq: entry.seq, ts: entry.ts, event: entry.event, data: JSON.parse(entry.payload) }))
      return replayPage(value, read.after, messages, configuration.policy.maxReplayBytes)
    },
    async prune(channel) { const value = state(channel); return { prunedThrough: value.prunedThrough, head: { incarnation: value.incarnation, seq: value.highWaterMark } } },
  }
}
