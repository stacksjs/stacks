import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'AutomationRun',
  table: 'automation_runs',
  belongsTo: ['Team', 'Automation'],
  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: { uri: 'automation-runs', routes: ['index', 'show'], middleware: ['auth', 'team'] },
  },
  indexes: [{ name: 'automation_runs_idempotency_unique', columns: ['idempotency_key'], unique: true }],
  attributes: {
    status: { required: true, fillable: true, default: 'queued', validation: { rule: schema.enum(['queued', 'running', 'waiting', 'completed', 'failed', 'cancelled']) }, factory: () => 'queued' },
    currentNodeId: { required: false, fillable: true, validation: { rule: schema.string().max(100) }, factory: () => null },
    version: { required: true, fillable: true, default: 1, validation: { rule: schema.number().min(1) }, factory: () => 1 },
    subjectType: { required: false, fillable: true, validation: { rule: schema.string().max(80) }, factory: () => 'contact' },
    subjectId: { required: false, fillable: true, validation: { rule: schema.string().max(120) }, factory: () => null },
    context: { required: true, fillable: true, validation: { rule: schema.json() }, factory: () => JSON.stringify({}) },
    idempotencyKey: { required: true, fillable: true, validation: { rule: schema.string().max(255) }, factory: faker => faker.string.uuid() },
    startedAt: { required: false, fillable: true, validation: { rule: schema.timestamp() }, factory: () => null },
    finishedAt: { required: false, fillable: true, validation: { rule: schema.timestamp() }, factory: () => null },
    error: { required: false, fillable: true, validation: { rule: schema.string() }, factory: () => null },
  },
} as const)
