import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

/** Bounded worker telemetry, shared by queue workers and the dashboard process. */
export default defineModel({
  name: 'QueueWorker',
  table: 'queue_workers',
  primaryKey: 'worker_id',
  autoIncrement: false,
  traits: { useTimestamps: false },
  dashboard: { access: false },
  indexes: [{ name: 'queue_workers_heartbeat_at_index', columns: ['heartbeat_at'] }],
  attributes: {
    worker_id: { required: true, fillable: true, validation: { rule: schema.string().required().max(255) } },
    snapshot: { type: 'text', required: true, fillable: true, validation: { rule: schema.string().required() } },
    heartbeat_at: { type: 'bigint', required: true, fillable: true, validation: { rule: schema.integer().required() } },
  },
} as const)
