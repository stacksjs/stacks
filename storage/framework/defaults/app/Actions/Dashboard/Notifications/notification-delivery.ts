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

export function parseDeliveryMetadata(value: string | null): Record<string, unknown> {
  if (!value)
    return {}

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object'
      ? parsed as Record<string, unknown>
      : {}
  }
  catch {
    return {}
  }
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
    metadata: parseDeliveryMetadata(row.metadata),
    sent_at: String(row.sent_at || row.created_at || ''),
    created_at: String(row.created_at || ''),
  }
}
