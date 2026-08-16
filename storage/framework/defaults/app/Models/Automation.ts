import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Automation',
  table: 'automations',
  belongsTo: ['Team'],
  hasMany: ['AutomationRun'],
  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: { uri: 'automations', routes: ['index', 'store', 'show', 'update', 'destroy'], middleware: ['auth', 'team'] },
    observe: true,
  },
  attributes: {
    name: { required: true, fillable: true, validation: { rule: schema.string().max(255) }, factory: faker => faker.lorem.words(3) },
    status: { required: true, fillable: true, default: 'draft', validation: { rule: schema.enum(['draft', 'active', 'paused', 'archived']) }, factory: () => 'draft' },
    version: { required: true, fillable: true, default: 1, validation: { rule: schema.number().min(1) }, factory: () => 1 },
    trigger: { required: true, fillable: true, validation: { rule: schema.json() }, factory: () => JSON.stringify({ type: 'subscriber_joined' }) },
    graph: { required: true, fillable: true, validation: { rule: schema.json() }, factory: () => JSON.stringify({ nodes: [], edges: [] }) },
    publishedAt: { required: false, fillable: true, validation: { rule: schema.timestamp() }, factory: () => null },
  },
} as const)
