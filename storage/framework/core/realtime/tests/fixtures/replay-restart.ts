// One server process's life: it buffers two messages on a channel and
// answers a replay for the seq a client saw before this process started.
import { recordBroadcast, replaySince, setReplayBuffer } from '../../src/replay-buffer'

const lastSeenBeforeRestart = Number(process.argv[2] ?? 0)
setReplayBuffer({ channels: ['*'] })
const sent = [recordBroadcast('orders', 'updated', { n: 1 }), recordBroadcast('orders', 'updated', { n: 2 })]
process.stdout.write(`${JSON.stringify({ sent, replayed: replaySince('orders', lastSeenBeforeRestart).map(message => message.seq) })}\n`)
