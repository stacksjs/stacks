import type { DurableReplayAppend, DurableReplayCursor, DurableReplayMessage, DurableReplayStore } from './durable-replay-contract'
import { channelName, DurableReplayError, readInput } from './durable-replay-contract'

/** Finite authenticated replay request. Select the channel on the server; the
 * store's partition labels and the cursor are never proof of current authority. */
export async function createDurableReplayResponse(options: { store: DurableReplayStore, channel: string, after: DurableReplayCursor | null, limit?: number, authorize: (channel: string) => boolean | Promise<boolean> }): Promise<Response> {
  channelName(options.channel)
  if (typeof options.authorize !== 'function') throw new TypeError('Durable replay requires current channel authorization')
  const { store, channel, after, limit } = options, authorize = options.authorize.bind(options)
  const response = (data: unknown, status: number) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
  try {
    if (!await authorize(channel)) return response({ error: 'replay_forbidden' }, 403)
    let input
    try { input = readInput({ channel, after, limit }) }
    catch (error) { if (error instanceof TypeError) return response({ error: 'replay_input_invalid' }, 422); throw error }
    const result = await store.replay({ channel, ...input })
    if (!await authorize(channel)) return response({ error: 'replay_forbidden' }, 403)
    return response(result, result.gap ? 409 : 200)
  }
  catch (error) {
    return response({ error: error instanceof DurableReplayError ? error.code : 'replay_unavailable' }, error instanceof DurableReplayError && error.code === 'replay_idempotency_conflict' ? 409 : 503)
  }
}

/** Persist first, then notify. Notification is an at-least-once hint: retries
 * notify retained duplicates too, so consumers deduplicate by incarnation/seq.
 * A crash or failed notify never removes the event from replay. No fan-out is provided. */
export async function publishDurableReplay(options: { store: DurableReplayStore, input: DurableReplayAppend, notify: (channel: string, message: DurableReplayMessage, cursor: DurableReplayCursor) => void | Promise<void> }): Promise<Awaited<ReturnType<DurableReplayStore['append']>>> {
  const notify = options.notify.bind(options), channel = options.input.channel
  const result = await options.store.append(options.input)
  await notify(channel, result.message, result.cursor)
  return result
}
