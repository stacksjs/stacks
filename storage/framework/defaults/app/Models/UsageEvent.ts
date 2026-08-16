import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'UsageEvent',
  table: 'usage_events',
  belongsTo: ['Team'],
  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: { uri: 'usage-events', routes: ['index', 'show'], middleware: ['auth', 'team'] },
  },
  indexes: [
    { name: 'usage_events_idempotency_unique', columns: ['idempotency_key'], unique: true },
    { name: 'usage_events_meter_period', columns: ['team_id', 'meter', 'occurred_at'] },
  ],
  attributes: {
    meter: { required: true, fillable: true, validation: { rule: schema.enum(['contacts', 'email_sends', 'sms_segments', 'ai_generations', 'storage_bytes']) }, factory: () => 'email_sends' },
    quantity: { required: true, fillable: true, default: 1, validation: { rule: schema.number().min(0) }, factory: () => 1 },
    idempotencyKey: { required: true, fillable: true, validation: { rule: schema.string().max(255) }, factory: faker => faker.string.uuid() },
    metadata: { required: false, fillable: true, validation: { rule: schema.json() }, factory: () => JSON.stringify({}) },
    occurredAt: { required: true, fillable: true, validation: { rule: schema.timestamp() }, factory: () => new Date().toISOString() },
  },
} as const)
