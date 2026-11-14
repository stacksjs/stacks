import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'ReplayChannel', table: 'replay_channels', traits: { useTimestamps: false }, dashboard: { access: false },
  indexes: [{ name: 'replay_channel_partition', columns: ['workspace_id', 'project_id', 'name'], unique: true }],
  attributes: {
    workspaceId: { type: 'bigint', required: true, validation: { rule: schema.number().integer() } },
    projectId: { type: 'bigint', required: true, validation: { rule: schema.number().integer() } },
    name: { required: true, validation: { rule: schema.string().max(200) } },
    incarnation: { required: true, unique: true, validation: { rule: schema.string().max(36) } },
    highWaterMark: { type: 'bigint', required: true, default: 0 },
    prunedThrough: { type: 'bigint', required: true, default: 0 },
    lastRecordedAt: { type: 'bigint', required: true, default: 0 },
    policy: { required: true, validation: { rule: schema.string().max(200) } },
  },
} as const)
