import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'CampaignVariant',
  table: 'campaign_variants',
  belongsTo: ['Team', 'Campaign'],
  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: { uri: 'campaign-variants', routes: ['index', 'store', 'show', 'update', 'destroy'], middleware: ['auth', 'team'] },
  },
  indexes: [{ name: 'campaign_variants_name_unique', columns: ['campaign_id', 'name'], unique: true }],
  attributes: {
    name: { required: true, fillable: true, validation: { rule: schema.string().max(80) }, factory: faker => faker.helpers.arrayElement(['Control', 'Variant B']) },
    subject: { required: false, fillable: true, validation: { rule: schema.string().max(255) }, factory: faker => faker.lorem.sentence(6) },
    content: { required: true, fillable: true, validation: { rule: schema.json() }, factory: () => JSON.stringify([]) },
    allocation: { required: true, fillable: true, default: 50, validation: { rule: schema.number().min(0).max(100) }, factory: () => 50 },
    sentCount: { required: true, fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    openCount: { required: true, fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    clickCount: { required: true, fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    conversionCount: { required: true, fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    isWinner: { required: true, fillable: true, default: false, validation: { rule: schema.boolean() }, factory: () => false },
  },
} as const)
