export interface NotificationDeliveryRow {
  id: number
  user_id: number | null
  channel: string
  recipient: string
  subject: string | null
  body: string
  status: string
  error: string | null
  metadata: string | null
  sent_at: string | null
  created_at: string
  updated_at: string | null
}

export interface DashboardNotificationDelivery {
  id: number
  user_id: number | null
  channel: string
  recipient: string
  subject: string
  body: string
  status: string
  error: string
  metadata: Record<string, unknown>
  sent_at: string
  created_at: string
}

export function parseDeliveryMetadata(
  value: unknown,
  label = 'notification delivery metadata',
): Record<string, unknown> {
  if (value === null || value === undefined || value === '')
    return {}

  if (typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>

  if (typeof value !== 'string')
    throw new TypeError(`${label} must be a JSON object`)

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  }
  catch (error) {
    throw new Error(`Could not parse ${label}: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new TypeError(`${label} must be a JSON object`)

  return parsed as Record<string, unknown>
}

export function serializeNotificationDelivery(row: NotificationDeliveryRow): DashboardNotificationDelivery {
  return {
    id: Number(row.id),
    user_id: row.user_id === null ? null : Number(row.user_id),
    channel: String(row.channel || ''),
    recipient: String(row.recipient || ''),
    subject: String(row.subject || ''),
    body: String(row.body || ''),
    status: String(row.status || 'pending'),
    error: String(row.error || ''),
    metadata: parseDeliveryMetadata(row.metadata, `notification delivery ${row.id} metadata`),
    sent_at: String(row.sent_at || row.created_at || ''),
    created_at: String(row.created_at || ''),
  }
}
