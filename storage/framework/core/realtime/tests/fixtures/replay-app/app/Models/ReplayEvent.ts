import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'ReplayEvent', table: 'replay_events', traits: { useTimestamps: false }, dashboard: { access: false },
  indexes: [
    { name: 'replay_event_sequence', columns: ['channel_id', 'seq'], unique: true },
    { name: 'replay_event_operation', columns: ['channel_id', 'operation_key'], unique: true },
    { name: 'replay_event_retention', columns: ['channel_id', 'recorded_at'] },
  ],
  attributes: {
    workspaceId: { type: 'bigint', required: true, validation: { rule: schema.number().integer() } },
    projectId: { type: 'bigint', required: true, validation: { rule: schema.number().integer() } },
    channelId: { type: 'bigint', required: true, foreignKey: { table: 'replay_channels', onDelete: 'cascade' } },
    seq: { type: 'bigint', required: true },
    operationKey: { required: true, hidden: true, validation: { rule: schema.string().max(200) } },
    fingerprint: { required: true, hidden: true, validation: { rule: schema.string().max(64) } },
    event: { required: true, validation: { rule: schema.string().max(200) } },
    payload: { type: 'text', required: true, hidden: true },
    recordedAt: { type: 'bigint', required: true },
  },
} as const)
