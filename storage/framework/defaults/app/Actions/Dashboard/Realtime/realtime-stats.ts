export interface WebsocketEventRow {
  id: string
  type: string
  socket: string
  details: string
  time: number
  createdAt: string
}

function timestamp(event: WebsocketEventRow): number {
  const raw = Number(event.time || 0)
  if (raw > 0)
    return raw < 10_000_000_000 ? raw * 1000 : raw
  return new Date(event.createdAt).getTime()
}

export function buildRealtimeStats(rows: WebsocketEventRow[]) {
  const events = [...rows]
    .sort((left, right) => timestamp(right) - timestamp(left))
    .map(event => ({
      ...event,
      occurredAt: new Date(timestamp(event)).toISOString(),
    }))

  const successes = events.filter(event => event.type === 'success').length
  const errors = events.filter(event => event.type === 'error').length
  const disconnections = events.filter(event => event.type === 'disconnection').length

  return {
    overview: {
      recordedEvents: events.length,
      uniqueSockets: new Set(events.map(event => event.socket).filter(Boolean)).size,
      successes,
      errors,
      disconnections,
      successRate: events.length > 0 ? Math.round((successes / events.length) * 1000) / 10 : 0,
    },
    events: events.slice(0, 100),
  }
}
